/**
 * player.js
 * A small glowing sphere that the visitor controls.
 * Handles movement, floating animation, and the glow corona.
 */

class Player {
  /**
   * @param {THREE.Scene} scene
   * @param {Controls}    controls
   */
  constructor(scene, controls) {
    this.scene    = scene;
    this.controls = controls;

    // Movement config
    this.speed        = 12;   // units/s
    this.damping      = 0.88; // velocity decay per frame
    this.velocity     = new THREE.Vector3();

    // Float animation
    this._floatTime   = 0;
    this._floatAmp    = 0.18;
    this._floatFreq   = 1.4;

    // Build mesh group
    this.group = new THREE.Group();
    this._buildMesh();
    scene.add(this.group);

    // Starting position
    this.group.position.set(0, 0, 30);
  }

  // ─── Build ───────────────────────────────────────────────────────────────

  _buildMesh() {
    // Core sphere
    const coreGeo = new THREE.SphereGeometry(0.35, 24, 24);
    const coreMat = new THREE.MeshStandardMaterial({
      color:     0xddd6fe,
      emissive:  0x7c3aed,
      emissiveIntensity: 1.8,
      roughness: 0.1,
      metalness: 0.3,
    });
    this.coreMesh = new THREE.Mesh(coreGeo, coreMat);
    this.group.add(this.coreMesh);

    // Outer glow shell (additive blend, slightly larger)
    const glowGeo = new THREE.SphereGeometry(0.6, 16, 16);
    const glowMat = new THREE.MeshBasicMaterial({
      color:       0x8b5cf6,
      transparent: true,
      opacity:     0.18,
      side:        THREE.BackSide,
      depthWrite:  false,
      blending:    THREE.AdditiveBlending,
    });
    this.glowMesh = new THREE.Mesh(glowGeo, glowMat);
    this.group.add(this.glowMesh);

    // Halo (flat sprite-like ring)
    const haloGeo = new THREE.SphereGeometry(0.9, 12, 12);
    const haloMat = new THREE.MeshBasicMaterial({
      color:       0x6d28d9,
      transparent: true,
      opacity:     0.07,
      side:        THREE.BackSide,
      depthWrite:  false,
      blending:    THREE.AdditiveBlending,
    });
    this.haloMesh = new THREE.Mesh(haloGeo, haloMat);
    this.group.add(this.haloMesh);

    // Point light so nearby objects are lit by the player
    this.light = new THREE.PointLight(0x8b5cf6, 1.5, 18);
    this.group.add(this.light);
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  get position() { return this.group.position; }

  /**
   * update — called every frame from the main loop
   * @param {number} dt  delta time in seconds
   * @param {number} t   elapsed time in seconds
   * @param {THREE.Camera} camera
   */
  update(dt, t, camera) {
    this._handleMovement(dt, camera);
    this._animateFloat(t);
    this._animateGlow(t);
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  _handleMovement(dt, camera) {
    const k = this.controls.keys;

    // Build movement direction relative to camera's horizontal look
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

    // Damping
    this.velocity.multiplyScalar(this.damping);

    this.group.position.add(this.velocity);

    // Tilt player slightly in movement direction
    if (this.velocity.lengthSq() > 0.0001) {
      const tiltX = -this.velocity.z * 0.8;
      const tiltZ =  this.velocity.x * 0.8;
      this.group.rotation.x += (tiltX - this.group.rotation.x) * 0.08;
      this.group.rotation.z += (tiltZ - this.group.rotation.z) * 0.08;
    } else {
      this.group.rotation.x *= 0.9;
      this.group.rotation.z *= 0.9;
    }
  }

  _animateFloat(t) {
    this._floatTime = t;
    this.coreMesh.position.y = Math.sin(t * this._floatFreq) * this._floatAmp;
    this.glowMesh.position.y = this.coreMesh.position.y;
    this.haloMesh.position.y = this.coreMesh.position.y;
    this.light.position.y    = this.coreMesh.position.y;
  }

  _animateGlow(t) {
    // Pulse emissive intensity
    const pulse = 1.6 + Math.sin(t * 2.2) * 0.4;
    this.coreMesh.material.emissiveIntensity = pulse;

    // Pulse outer glow opacity
    this.glowMesh.material.opacity = 0.14 + Math.sin(t * 1.8) * 0.06;
    this.light.intensity           = 1.2 + Math.sin(t * 2.5) * 0.4;
  }

  setSpeed(s) { this.speed = s; }

  setVisible(v) { this.group.visible = v; }
}
