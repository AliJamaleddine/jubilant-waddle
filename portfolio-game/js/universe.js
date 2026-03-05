/**
 * universe.js — Orchestrates the whole experience.
 *
 * Responsibilities:
 *  - Define and position all 5 themed galaxies
 *  - Third-person camera follow (space mode)
 *  - Proximity detection + label display
 *  - Galaxy enter (warp) / exit transitions
 *  - Photo world build / destroy inside a galaxy
 *  - Raycaster photo hover + click → lightbox
 */

class Universe {
  constructor(sceneManager, player, controls) {
    this.sm       = sceneManager;
    this.player   = player;
    this.controls = controls;

    this.galaxies     = [];
    this.nearGalaxy   = null;
    this.activeGalaxy = null;
    this.inGalaxy     = false;

    // Camera follow (space mode)
    this._camOffset    = new THREE.Vector3(0, 7, 20);
    this._camLerpSpeed = 0.055;

    // DOM refs
    this._labelEl      = document.getElementById('galaxy-label');
    this._nameEl       = document.getElementById('galaxy-name');
    this._galaxyUI     = document.getElementById('galaxy-ui');
    this._galaxyTitle  = document.getElementById('galaxy-title');
    this._exitBtn      = document.getElementById('galaxy-exit');
    this._exitBtn.addEventListener('click', () => this._exitGalaxy());

    // Photo world
    this._photoMeshes  = [];
    this._photoGroup   = null;
    this._hoveredPhoto = null;

    // Raycaster
    this._raycaster = new THREE.Raycaster();
    this._mouse     = new THREE.Vector2(9999, 9999); // off-screen default

    window.addEventListener('mousemove', e => {
      this._mouse.x =  (e.clientX / window.innerWidth)  * 2 - 1;
      this._mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    });

    window.addEventListener('click', () => {
      if (this.inGalaxy && this._hoveredPhoto) {
        this._openLightbox(this._hoveredPhoto);
      }
    });

    document.getElementById('lightbox-close').addEventListener('click', () => {
      document.getElementById('lightbox').classList.add('hidden');
    });

    this._buildGalaxies();
  }

  // ─── Galaxy definitions ──────────────────────────────────────────────────

  _buildGalaxies() {
    const defs = [
      {
        name:     'Mountains',
        theme:    'mountains',
        pos:      new THREE.Vector3(-48, 2, -38),
        // Dark rock → slate → stone → snow-grey → ice blue
        colors:   ['#1c2526', '#3d5460', '#708090', '#b0bec5', '#90caf9'],
        radius:   11,
        rotSpeed: 0.035,
      },
      {
        name:     'Ocean',
        theme:    'ocean',
        pos:      new THREE.Vector3(46, -3, -28),
        // Deep navy → royal blue → cyan → turquoise → foam
        colors:   ['#03045e', '#0077b6', '#00b4d8', '#48cae4', '#caf0f8'],
        radius:   12,
        rotSpeed: 0.055,
      },
      {
        name:     'Portraits',
        theme:    'portraits',
        pos:      new THREE.Vector3(2, 6, -72),
        // Terracotta → amber → rose → mauve → lavender
        colors:   ['#c0392b', '#e67e22', '#f1948a', '#d7bde2', '#c39bd3'],
        radius:   9,
        rotSpeed: 0.06,
      },
      {
        name:     'Cities',
        theme:    'cities',
        pos:      new THREE.Vector3(-52, -4, -68),
        // Dark charcoal → steel → electric blue → neon cyan → white
        colors:   ['#14213d', '#495057', '#4361ee', '#4cc9f0', '#f0f4ff'],
        radius:   11,
        rotSpeed: 0.028,
      },
      {
        name:     'Forest',
        theme:    'forest',
        pos:      new THREE.Vector3(56, 4, -58),
        // Deep pine → forest → emerald → light leaf → pale lime
        colors:   ['#1b4332', '#2d6a4f', '#52b788', '#95d5b2', '#d8f3dc'],
        radius:   11,
        rotSpeed: 0.048,
      },
    ];

    for (const def of defs) {
      const galaxy = new Galaxy({
        ...def,
        position:     def.pos,
        particleCount:5000,
        photos:       this._placeholderPhotos(def.name, 6),
      });
      this.galaxies.push(galaxy);
      this.sm.scene.add(galaxy.group);
    }
  }

  _placeholderPhotos(category, count) {
    return Array.from({ length: count }, (_, i) => ({
      url:     `https://picsum.photos/seed/${category}${i+1}/800/600`,
      caption: `${category} — ${String(i + 1).padStart(2, '0')}`,
    }));
  }

  // ─── Main update ────────────────────────────────────────────────────────

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

    // Smooth third-person camera follow
    const camTarget = new THREE.Vector3(
      playerPos.x + this._camOffset.x,
      playerPos.y + this._camOffset.y,
      playerPos.z + this._camOffset.z
    );
    this.sm.camera.position.lerp(camTarget, this._camLerpSpeed);
    this.sm.camera.lookAt(playerPos.x, playerPos.y, playerPos.z);

    // Dust motes follow camera for infinite-void feel
    this.sm.dustMesh.position.copy(this.sm.camera.position);

    // Proximity detection
    let closestDist   = Infinity;
    let closestGalaxy = null;

    for (const galaxy of this.galaxies) {
      const d          = playerPos.distanceTo(galaxy.group.position);
      const enterR     = galaxy.radius + 7;
      const glowR      = galaxy.radius + 22;
      const proximity  = THREE.MathUtils.clamp(
        1 - (d - enterR) / (glowR - enterR), 0, 1
      );

      galaxy.update(dt, t, proximity);

      if (d < glowR && d < closestDist) {
        closestDist   = d;
        closestGalaxy = galaxy;
      }
    }

    // Label
    if (closestGalaxy && closestDist < closestGalaxy.radius + 20) {
      this.nearGalaxy = closestGalaxy;
      this._nameEl.textContent = closestGalaxy.name;
      // Set CSS accent color so the underline rule matches the galaxy
      document.documentElement.style.setProperty(
        '--galaxy-color', closestGalaxy.accentHex
      );
      this._labelEl.classList.add('visible');
    } else {
      this.nearGalaxy = null;
      this._labelEl.classList.remove('visible');
    }

    // E = enter nearest galaxy
    if (this.controls.keys.interact && this.nearGalaxy) {
      this.controls.consumeInteract();
      this._enterGalaxy(this.nearGalaxy);
      return;
    }
    if (this.controls.keys.escape) this.controls.consumeEscape();
  }

  // ─── Galaxy enter / exit ─────────────────────────────────────────────────

  _enterGalaxy(galaxy) {
    this.inGalaxy     = true;
    this.activeGalaxy = galaxy;

    // Freeze player movement while inside
    this.player.setMovable(false);

    this._labelEl.classList.remove('visible');

    // Warp: FOV zoom-in punch, then snap
    const cam = this.sm.camera;
    gsap.timeline()
      .to(cam, {
        fov: 105,
        duration: 0.5,
        ease: 'power2.in',
        onUpdate: () => cam.updateProjectionMatrix(),
      })
      .to(cam, {
        fov: 60,
        duration: 0,
        onUpdate: () => cam.updateProjectionMatrix(),
      })
      .call(() => {
        this._buildPhotoWorld(galaxy);
        this._showGalaxyUI(galaxy);
      });
  }

  _exitGalaxy() {
    if (!this.inGalaxy) return;

    this._destroyPhotoWorld();
    this._hideGalaxyUI();

    // Brief fade, then restore space mode
    gsap.to('#canvas', {
      opacity: 0.4,
      duration: 0.25,
      onComplete: () => {
        this.inGalaxy     = false;
        this.activeGalaxy = null;
        this.player.setMovable(true);
        gsap.to('#canvas', { opacity: 1, duration: 0.55 });
      },
    });
  }

  // ─── Galaxy UI ──────────────────────────────────────────────────────────

  _showGalaxyUI(galaxy) {
    this._galaxyTitle.textContent = galaxy.name.toUpperCase();
    this._galaxyUI.classList.remove('hidden');
    this._galaxyUI.classList.add('visible');
    gsap.fromTo('#galaxy-ui', { opacity: 0 }, { opacity: 1, duration: 0.5 });
  }

  _hideGalaxyUI() {
    gsap.to('#galaxy-ui', {
      opacity: 0,
      duration: 0.3,
      onComplete: () => {
        this._galaxyUI.classList.remove('visible');
        this._galaxyUI.classList.add('hidden');
      },
    });
  }

  // ─── Photo world ────────────────────────────────────────────────────────

  _buildPhotoWorld(galaxy) {
    this._photoGroup = new THREE.Group();
    this.sm.scene.add(this._photoGroup);

    const photos = galaxy.photos;
    const count  = photos.length;

    for (let i = 0; i < count; i++) {
      const angle  = (i / count) * Math.PI * 2;
      const radius = 13 + (i % 2) * 5;
      const x      = Math.cos(angle) * radius;
      const z      = Math.sin(angle) * radius;
      const y      = (Math.random() - 0.5) * 6;

      const panel = this._createPhotoPanel(photos[i]);
      panel.position.set(x, y, z);
      panel.lookAt(0, panel.position.y, 0);
      panel.rotation.x += (Math.random() - 0.5) * 0.12;

      this._photoGroup.add(panel);
      this._photoMeshes.push(panel);

      // Spring-in animation
      panel.scale.setScalar(0.01);
      gsap.to(panel.scale, {
        x: 1, y: 1, z: 1,
        duration: 0.55,
        delay: i * 0.07,
        ease: 'back.out(1.5)',
      });
    }

    // Fly camera into gallery position
    gsap.to(this.sm.camera.position, {
      x: 0, y: 2, z: 32,
      duration: 1.0,
      ease: 'power2.out',
    });
  }

  _createPhotoPanel(photoData) {
    const W = 5.0, H = 3.5;

    // White Polaroid-style frame
    const frameGeo = new THREE.BoxGeometry(W + 0.3, H + 0.6, 0.04);
    const frameMat = new THREE.MeshStandardMaterial({
      color:     0xfafafa,
      roughness: 0.6,
      metalness: 0.0,
    });
    const frame = new THREE.Mesh(frameGeo, frameMat);
    frame.position.y = -0.1; // frame sits slightly lower (Polaroid bottom)

    // Photo surface
    const planeGeo = new THREE.PlaneGeometry(W, H);
    const planeMat = new THREE.MeshBasicMaterial({
      color:       0xe8e8e8, // light-grey placeholder
      transparent: true,
      opacity:     1,
    });
    const plane = new THREE.Mesh(planeGeo, planeMat);
    plane.position.z = 0.03;

    // Lazy-load texture
    new THREE.TextureLoader().load(
      photoData.url,
      tex => {
        tex.encoding    = THREE.sRGBEncoding;
        planeMat.map    = tex;
        planeMat.color.setHex(0xffffff);
        planeMat.needsUpdate = true;
      }
    );

    const group = new THREE.Group();
    group.add(frame);
    group.add(plane);

    group.userData    = { photoData };
    plane.userData    = { isPhoto: true, parent: group, photoData };

    return group;
  }

  _destroyPhotoWorld() {
    if (!this._photoGroup) return;

    for (const mesh of this._photoMeshes) {
      mesh.traverse(child => {
        if (child.isMesh) {
          child.geometry.dispose();
          if (child.material.map) child.material.map.dispose();
          child.material.dispose();
        }
      });
    }

    this.sm.scene.remove(this._photoGroup);
    this._photoGroup   = null;
    this._photoMeshes  = [];
    this._hoveredPhoto = null;
    document.body.style.cursor = 'none';
  }

  // ─── Galaxy mode ─────────────────────────────────────────────────────────

  _updateGalaxyMode(dt, t) {
    // Keep camera pointed at gallery centre
    this.sm.camera.lookAt(0, 0, 0);

    // Slowly orbit the photo world
    if (this._photoGroup) {
      this._photoGroup.rotation.y += 0.0007;

      // Individual float
      this._photoMeshes.forEach((m, i) => {
        m.position.y += Math.sin(t * 0.55 + i * 1.2) * 0.003;
      });
    }

    this._updatePhotoHover();

    // ESC = exit galaxy
    if (this.controls.keys.escape) {
      this.controls.consumeEscape();
      this._exitGalaxy();
    }
  }

  _updatePhotoHover() {
    if (!this._photoGroup) return;

    this._raycaster.setFromCamera(this._mouse, this.sm.camera);

    const planes = [];
    this._photoMeshes.forEach(grp =>
      grp.traverse(child => { if (child.userData.isPhoto) planes.push(child); })
    );

    const hits = this._raycaster.intersectObjects(planes, false);

    if (hits.length > 0) {
      const hit = hits[0].object;
      if (this._hoveredPhoto !== hit) {
        if (this._hoveredPhoto) {
          gsap.to(this._hoveredPhoto.parent.scale, { x: 1, y: 1, z: 1, duration: 0.2 });
        }
        this._hoveredPhoto = hit;
        gsap.to(hit.parent.scale, { x: 1.07, y: 1.07, z: 1.07, duration: 0.2 });
        document.body.style.cursor = 'pointer';
      }
    } else {
      if (this._hoveredPhoto) {
        gsap.to(this._hoveredPhoto.parent.scale, { x: 1, y: 1, z: 1, duration: 0.2 });
        this._hoveredPhoto = null;
        document.body.style.cursor = 'none';
      }
    }
  }

  _openLightbox(photoMesh) {
    const { photoData } = photoMesh.userData;
    document.getElementById('lightbox-img').src     = photoData.url;
    document.getElementById('lightbox-caption').textContent = photoData.caption;
    document.getElementById('lightbox').classList.remove('hidden');
  }
}
