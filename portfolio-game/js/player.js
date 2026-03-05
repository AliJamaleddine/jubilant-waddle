/**
 * player.js — Tiny dark minimal sphere.
 * Very simple: a small dark dot floating in the white void.
 * No glow. Just a clean silhouette + subtle shadow disc.
 */

class Player {
  constructor(scene, controls) {
    this.scene    = scene;
    this.controls = controls;

    this.speed    = 14;
    this.damping  = 0.86;
    this.velocity = new THREE.Vector3();

    this._floatAmp  = 0.1;
    this._floatFreq = 1.1;

    // Whether the player is allowed to move (disabled inside galaxy)
    this.movable  = true;

    this.group = new THREE.Group();
    this._buildMesh();
    scene.add(this.group);

    // Start slightly in front of the camera
    this.group.position.set(0, 0, 28);
  }

  // ─── Build ───────────────────────────────────────────────────────────────

  _buildMesh() {
    // Core: small dark charcoal sphere — clean, iconic
    const coreGeo = new THREE.SphereGeometry(0.26, 24, 24);
    const coreMat = new THREE.MeshStandardMaterial({
      color:     0x18181b,
      roughness: 0.45,
      metalness: 0.05,
    });
    this.coreMesh = new THREE.Mesh(coreGeo, coreMat);
    this.group.add(this.coreMesh);

    // Flat shadow disc below — grounds the floating sphere visually
    const shadowGeo = new THREE.CircleGeometry(0.22, 20);
    const shadowMat = new THREE.MeshBasicMaterial({
      color:       0x000000,
      transparent: true,
      opacity:     0.07,
      depthWrite:  false,
    });
    this.shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    this.shadowMesh.rotation.x = -Math.PI / 2;
    this.shadowMesh.position.y = -0.38;
    this.group.add(this.shadowMesh);
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  get position() { return this.group.position; }

  setMovable(v) { this.movable = v; }
  setVisible(v) { this.group.visible = v; }

  update(dt, t, camera) {
    if (this.movable) this._handleMovement(dt, camera);
    this._animateFloat(t);
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  _handleMovement(dt, camera) {
    const k = this.controls.keys;

    // Direction relative to camera's horizontal look
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3();
    right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

    const move = new THREE.Vector3();
    if (k.forward)  move.add(forward);
    if (k.backward) move.sub(forward);
    if (k.right)    move.add(right);
    if (k.left)     move.sub(right);

    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(this.speed * dt);
      this.velocity.add(move);
    }

    this.velocity.multiplyScalar(this.damping);
    this.group.position.add(this.velocity);

    // Subtle tilt while moving
    if (this.velocity.lengthSq() > 0.0001) {
      this.group.rotation.x += (-this.velocity.z * 0.5 - this.group.rotation.x) * 0.1;
      this.group.rotation.z += ( this.velocity.x * 0.5 - this.group.rotation.z) * 0.1;
    } else {
      this.group.rotation.x *= 0.88;
      this.group.rotation.z *= 0.88;
    }
  }

  _animateFloat(t) {
    const floatY = Math.sin(t * this._floatFreq) * this._floatAmp;
    this.coreMesh.position.y = floatY;

    // Shadow shrinks and fades as sphere rises
    const shadowT = 1 - (floatY + this._floatAmp) / (this._floatAmp * 2);
    this.shadowMesh.position.y  = -0.38;
    this.shadowMesh.material.opacity = 0.04 + shadowT * 0.06;
    const shadowScale = 0.85 + shadowT * 0.3;
    this.shadowMesh.scale.setScalar(shadowScale);
  }
}
