/**
 * universe.js
 * Orchestrates: galaxies, player, camera follow, proximity detection,
 * galaxy enter/exit transitions, and the in-galaxy photo world.
 */

class Universe {
  /**
   * @param {SceneManager} sceneManager
   * @param {Player}       player
   * @param {Controls}     controls
   */
  constructor(sceneManager, player, controls) {
    this.sm       = sceneManager;
    this.player   = player;
    this.controls = controls;

    this.galaxies       = [];
    this.nearGalaxy     = null;   // Galaxy the player is currently near
    this.activeGalaxy   = null;   // Galaxy the player has entered
    this.inGalaxy       = false;

    // Camera follow config (third-person)
    this._camOffset      = new THREE.Vector3(0, 6, 18);
    this._camTarget      = new THREE.Vector3();
    this._camCurrentPos  = new THREE.Vector3();
    this._camLerpSpeed   = 0.06;

    // DOM references
    this._labelEl      = document.getElementById('galaxy-label');
    this._nameEl       = document.getElementById('galaxy-name');
    this._galaxyUI     = document.getElementById('galaxy-ui');
    this._galaxyTitle  = document.getElementById('galaxy-title');
    this._exitBtn      = document.getElementById('galaxy-exit');

    this._exitBtn.addEventListener('click', () => this._exitGalaxy());

    // Photo world state
    this._photoMeshes  = [];
    this._photoGroup   = null;
    this._hoveredPhoto = null;

    // Raycaster for photo hover/click
    this._raycaster = new THREE.Raycaster();
    this._mouse     = new THREE.Vector2();

    window.addEventListener('mousemove', e => {
      this._mouse.x = (e.clientX / window.innerWidth)  * 2 - 1;
      this._mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    });

    window.addEventListener('click', () => {
      if (this.inGalaxy && this._hoveredPhoto) {
        this._openLightbox(this._hoveredPhoto);
      }
    });

    // Lightbox close
    document.getElementById('lightbox-close').addEventListener('click', () => {
      document.getElementById('lightbox').classList.add('hidden');
    });

    this._buildGalaxies();
    this._positionStarfield();
  }

  // ─── Galaxy definitions ─────────────────────────────────────────────────

  _buildGalaxies() {
    const defs = [
      {
        name:   'Travel',
        pos:    new THREE.Vector3(-35, 4, -20),
        colors: ['#ff9a3c', '#ff6b6b', '#ffd93d', '#c44dff'],
        radius: 10,
        armCount: 3,
        photos: this._generatePlaceholderPhotos('Travel', 6),
      },
      {
        name:   'Portraits',
        pos:    new THREE.Vector3(40, -5, -30),
        colors: ['#43e8f4', '#1976d2', '#8066ff', '#00bcd4'],
        radius: 8,
        armCount: 2,
        photos: this._generatePlaceholderPhotos('Portraits', 5),
      },
      {
        name:   'Night',
        pos:    new THREE.Vector3(5, 8, -60),
        colors: ['#7b2fff', '#e040fb', '#2196f3', '#03dac6'],
        radius: 12,
        armCount: 4,
        photos: this._generatePlaceholderPhotos('Night', 7),
      },
    ];

    for (const def of defs) {
      const galaxy = new Galaxy({
        name:         def.name,
        position:     def.pos,
        colors:       def.colors,
        radius:       def.radius,
        armCount:     def.armCount,
        particleCount:4000,
        photos:       def.photos,
      });
      this.galaxies.push(galaxy);
      this.sm.scene.add(galaxy.group);
    }
  }

  /**
   * Generate placeholder photo entries.
   * In production, replace with real image paths.
   */
  _generatePlaceholderPhotos(category, count) {
    const photos = [];
    for (let i = 0; i < count; i++) {
      photos.push({
        // Use picsum for beautiful placeholder images
        url:     `https://picsum.photos/seed/${category}${i}/800/600`,
        caption: `${category} — ${String(i+1).padStart(2,'0')}`,
        thumb:   `https://picsum.photos/seed/${category}${i}/400/300`,
      });
    }
    return photos;
  }

  // ─── Starfield follows camera ────────────────────────────────────────────

  _positionStarfield() {
    // Starfield & nebula are added to scene but we update their position
    // to track camera center so they always surround the viewer.
    this._starfieldFollowsCamera = true;
  }

  // ─── Update (called every frame) ────────────────────────────────────────

  update(dt, t) {
    if (this.inGalaxy) {
      this._updateGalaxyMode(dt, t);
    } else {
      this._updateSpaceMode(dt, t);
    }

    this.sm.update(t);
  }

  // ─── Space mode ──────────────────────────────────────────────────────────

  _updateSpaceMode(dt, t) {
    const playerPos = this.player.position;

    // Camera follow (smooth third-person)
    this._updateCamera(dt);

    // Starfield/nebula follow camera so they always fill the background
    const cam = this.sm.camera;
    this.sm.starfieldMesh.position.copy(cam.position);
    this.sm.nebulaMesh.position.copy(cam.position);

    // Evaluate galaxy proximity
    let closestDist   = Infinity;
    let closestGalaxy = null;

    for (const galaxy of this.galaxies) {
      const d = playerPos.distanceTo(galaxy.group.position);
      // Proximity 0 = far (>enterThresh), 1 = right at enter boundary
      const enterThresh = galaxy.radius + 8;
      const glowThresh  = galaxy.radius + 20;
      const prox        = THREE.MathUtils.clamp(
        1 - (d - enterThresh) / (glowThresh - enterThresh), 0, 1
      );

      galaxy.update(dt, t, prox);

      if (d < glowThresh && d < closestDist) {
        closestDist   = d;
        closestGalaxy = galaxy;
      }
    }

    // Show/hide label
    if (closestGalaxy && closestDist < closestGalaxy.radius + 18) {
      this.nearGalaxy = closestGalaxy;
      this._nameEl.textContent = closestGalaxy.name;
      this._labelEl.classList.add('visible');
    } else {
      this.nearGalaxy = null;
      this._labelEl.classList.remove('visible');
    }

    // E key = enter galaxy
    if (this.controls.keys.interact && this.nearGalaxy) {
      this.controls.consumeInteract();
      this._enterGalaxy(this.nearGalaxy);
    }

    // ESC in space = nothing (already outside)
    if (this.controls.keys.escape) this.controls.consumeEscape();
  }

  _updateCamera(dt) {
    const pp = this.player.position;

    // Target: behind and above player
    this._camTarget.set(
      pp.x + this._camOffset.x,
      pp.y + this._camOffset.y,
      pp.z + this._camOffset.z
    );

    // Lazy follow
    this.sm.camera.position.lerp(this._camTarget, this._camLerpSpeed);
    this.sm.camera.lookAt(pp.x, pp.y, pp.z);
  }

  // ─── Galaxy enter / exit ─────────────────────────────────────────────────

  _enterGalaxy(galaxy) {
    this.inGalaxy    = true;
    this.activeGalaxy = galaxy;

    // Hide space HUD elements
    this._labelEl.classList.remove('visible');

    // Warp transition
    this._playWarpEffect(() => {
      // After warp completes:
      this._buildPhotoWorld(galaxy);
      this._showGalaxyUI(galaxy);
    });
  }

  _exitGalaxy() {
    if (!this.inGalaxy) return;

    // Clean up photo world
    this._destroyPhotoWorld();
    this._hideGalaxyUI();

    // Quick fade out
    gsap.to('#canvas', { opacity: 0.3, duration: 0.3, onComplete: () => {
      this.inGalaxy     = false;
      this.activeGalaxy = null;
      gsap.to('#canvas', { opacity: 1, duration: 0.6 });
    }});
  }

  _playWarpEffect(onComplete) {
    // Stars stretch: animate FOV up then snap to galaxy interior
    const cam = this.sm.camera;

    gsap.timeline()
      .to(cam, { fov: 120, duration: 0.6, ease: 'power2.in',
        onUpdate: () => cam.updateProjectionMatrix() })
      .to({}, { duration: 0.1 }) // hold at peak
      .to(cam, { fov: 65, duration: 0, onUpdate: () => cam.updateProjectionMatrix() })
      .call(onComplete);
  }

  // ─── Galaxy UI ──────────────────────────────────────────────────────────

  _showGalaxyUI(galaxy) {
    this._galaxyTitle.textContent = galaxy.name.toUpperCase();
    this._galaxyUI.classList.remove('hidden');
    this._galaxyUI.classList.add('visible');
    gsap.fromTo('#galaxy-ui', { opacity: 0 }, { opacity: 1, duration: 0.5 });
  }

  _hideGalaxyUI() {
    gsap.to('#galaxy-ui', { opacity: 0, duration: 0.3, onComplete: () => {
      this._galaxyUI.classList.add('hidden');
      this._galaxyUI.classList.remove('visible');
    }});
  }

  // ─── Photo world ────────────────────────────────────────────────────────

  _buildPhotoWorld(galaxy) {
    this._photoGroup = new THREE.Group();
    this.sm.scene.add(this._photoGroup);

    const photos = galaxy.photos;
    const count  = photos.length;

    // Arrange photos in an orbit ring, facing center
    for (let i = 0; i < count; i++) {
      const angle  = (i / count) * Math.PI * 2;
      const radius = 14 + (i % 2) * 4;
      const x      = Math.cos(angle) * radius;
      const z      = Math.sin(angle) * radius;
      const y      = (Math.random() - 0.5) * 5;

      const panel = this._createPhotoPanel(photos[i], i);
      panel.position.set(x, y, z);

      // Face the center
      panel.lookAt(0, panel.position.y, 0);

      // Tilt slightly
      panel.rotation.x += (Math.random() - 0.5) * 0.15;

      this._photoGroup.add(panel);
      this._photoMeshes.push(panel);

      // Animate in
      panel.scale.setScalar(0.01);
      gsap.to(panel.scale, {
        x: 1, y: 1, z: 1,
        duration: 0.6,
        delay: i * 0.08,
        ease: 'back.out(1.4)',
      });
    }

    // Position camera for interior view
    gsap.to(this.sm.camera.position, {
      x: 0, y: 3, z: 30,
      duration: 1.2,
      ease: 'power2.out',
    });
    this.sm.camera.lookAt(0, 0, 0);
  }

  _createPhotoPanel(photoData, index) {
    const W = 4.8, H = 3.4;

    // Frame
    const frameGeo = new THREE.BoxGeometry(W + 0.12, H + 0.12, 0.05);
    const frameMat = new THREE.MeshStandardMaterial({
      color:    0x1a1a2e,
      roughness:0.8,
      metalness:0.2,
    });
    const frame = new THREE.Mesh(frameGeo, frameMat);

    // Photo plane
    const planeGeo = new THREE.PlaneGeometry(W, H);
    const planeMat = new THREE.MeshBasicMaterial({
      color:      0x333355, // placeholder color until texture loads
      transparent:true,
      opacity:    1,
    });
    const plane = new THREE.Mesh(planeGeo, planeMat);
    plane.position.z = 0.04;

    // Load texture lazily
    const loader = new THREE.TextureLoader();
    loader.load(
      photoData.url,
      (tex) => {
        tex.encoding    = THREE.sRGBEncoding;
        planeMat.map    = tex;
        planeMat.color.setHex(0xffffff);
        planeMat.needsUpdate = true;
      },
      undefined,
      () => {
        // On error: keep placeholder
      }
    );

    const group = new THREE.Group();
    group.add(frame);
    group.add(plane);

    // Store metadata for interaction
    group.userData = { photoData, index, plane, planeMat };
    plane.userData = { isPhoto: true, parent: group, photoData };

    return group;
  }

  _destroyPhotoWorld() {
    if (!this._photoGroup) return;

    for (const mesh of this._photoMeshes) {
      // Dispose geometry and materials
      mesh.traverse(child => {
        if (child.isMesh) {
          child.geometry.dispose();
          if (child.material.map) child.material.map.dispose();
          child.material.dispose();
        }
      });
    }

    this.sm.scene.remove(this._photoGroup);
    this._photoGroup  = null;
    this._photoMeshes = [];
    this._hoveredPhoto = null;
  }

  // ─── Galaxy mode update ─────────────────────────────────────────────────

  _updateGalaxyMode(dt, t) {
    // Slowly rotate photo world
    if (this._photoGroup) {
      this._photoGroup.rotation.y += 0.0008;

      // Float photos up/down individually
      this._photoMeshes.forEach((m, i) => {
        m.position.y += Math.sin(t * 0.6 + i * 1.1) * 0.003;
      });
    }

    // Raycast for photo hover
    this._updatePhotoHover();

    // ESC = exit
    if (this.controls.keys.escape) {
      this.controls.consumeEscape();
      this._exitGalaxy();
    }
  }

  _updatePhotoHover() {
    if (!this._photoGroup) return;

    this._raycaster.setFromCamera(this._mouse, this.sm.camera);

    // Collect all photo planes
    const planes = [];
    this._photoMeshes.forEach(group => {
      group.traverse(child => {
        if (child.userData && child.userData.isPhoto) planes.push(child);
      });
    });

    const hits = this._raycaster.intersectObjects(planes, false);

    if (hits.length > 0) {
      const hit = hits[0].object;
      if (this._hoveredPhoto !== hit) {
        // Un-hover previous
        if (this._hoveredPhoto) {
          gsap.to(this._hoveredPhoto.parent.scale, { x:1, y:1, z:1, duration:0.2 });
          this._hoveredPhoto.material.emissive && (this._hoveredPhoto.material.emissiveIntensity = 0);
        }
        this._hoveredPhoto = hit;
        // Hover effect: scale up parent group
        gsap.to(hit.parent.scale, { x:1.06, y:1.06, z:1.06, duration:0.2 });
        document.body.style.cursor = 'pointer';
      }
    } else {
      if (this._hoveredPhoto) {
        gsap.to(this._hoveredPhoto.parent.scale, { x:1, y:1, z:1, duration:0.2 });
        this._hoveredPhoto = null;
        document.body.style.cursor = 'none';
      }
    }
  }

  _openLightbox(photoMesh) {
    const { photoData } = photoMesh.userData;
    const lb   = document.getElementById('lightbox');
    const img  = document.getElementById('lightbox-img');
    const cap  = document.getElementById('lightbox-caption');

    img.src    = photoData.url;
    cap.textContent = photoData.caption;
    lb.classList.remove('hidden');
  }
}
