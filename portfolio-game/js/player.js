/**
 * player.js — Simple stick-figure character.
 *
 * Anatomy (Y from ground):
 *   1.65  head (sphere)
 *   1.05  torso (cylinder)
 *   1.30  shoulder pivot → arms
 *   0.72  hip pivot      → legs
 *
 * Movement is purely on the XZ plane.
 * Character rotates to face movement direction.
 * Walk animation swings limbs via pivot Groups.
 */

class Player {
  constructor(scene, controls) {
    this.scene    = scene;
    this.controls = controls;

    this.speed   = 12;      // units/s
    this.damping = 0.82;
    this.velocity = new THREE.Vector3();
    this.movable  = true;

    this.group = new THREE.Group();
    this._buildFigure();
    scene.add(this.group);

    // Start position
    this.group.position.set(0, 0, 18);
  }

  // ─── Build figure ────────────────────────────────────────────────────────

  _buildFigure() {
    const mat = new THREE.MeshStandardMaterial({
      color: 0x18181b, roughness: 0.45, metalness: 0.0,
    });

    const M = (geo) => new THREE.Mesh(geo, mat);

    // Head
    const head = M(new THREE.SphereGeometry(0.2, 10, 10));
    head.position.y = 1.65;
    this.group.add(head);

    // Torso
    const torso = M(new THREE.CylinderGeometry(0.07, 0.09, 0.65, 7));
    torso.position.y = 1.02;
    this.group.add(torso);

    // ── Arms (pivot at shoulder) ────────────────
    this.leftArmPivot  = new THREE.Group();
    this.rightArmPivot = new THREE.Group();
    this.leftArmPivot.position.set(-0.13, 1.32, 0);
    this.rightArmPivot.position.set( 0.13, 1.32, 0);

    const armGeo = new THREE.CylinderGeometry(0.038, 0.038, 0.44, 6);
    const lArm = M(armGeo); lArm.position.y = -0.22;
    const rArm = M(armGeo); rArm.position.y = -0.22;
    this.leftArmPivot.add(lArm);
    this.rightArmPivot.add(rArm);

    // Rest angle: arms hang open slightly
    this.leftArmPivot.rotation.z  =  0.28;
    this.rightArmPivot.rotation.z = -0.28;

    this.group.add(this.leftArmPivot);
    this.group.add(this.rightArmPivot);

    // ── Legs (pivot at hip) ─────────────────────
    this.leftLegPivot  = new THREE.Group();
    this.rightLegPivot = new THREE.Group();
    this.leftLegPivot.position.set(-0.1, 0.72, 0);
    this.rightLegPivot.position.set( 0.1, 0.72, 0);

    const legGeo = new THREE.CylinderGeometry(0.052, 0.052, 0.72, 7);
    const lLeg = M(legGeo); lLeg.position.y = -0.36;
    const rLeg = M(legGeo); rLeg.position.y = -0.36;
    this.leftLegPivot.add(lLeg);
    this.rightLegPivot.add(rLeg);

    this.group.add(this.leftLegPivot);
    this.group.add(this.rightLegPivot);

    // Shadow disc on ground
    const shadowGeo = new THREE.CircleGeometry(0.28, 16);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000, transparent: true, opacity: 0.08, depthWrite: false,
    });
    this.shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    this.shadowMesh.rotation.x = -Math.PI / 2;
    this.shadowMesh.position.y = 0.01;
    this.group.add(this.shadowMesh);
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  get position() { return this.group.position; }
  setMovable(v) { this.movable = v; }

  update(dt, t, camera) {
    if (this.movable) this._move(dt, camera);
    this._animate(t);
  }

  // ─── Movement ────────────────────────────────────────────────────────────

  _move(dt, camera) {
    const k = this.controls.keys;

    // Flat direction relative to camera look
    const fwd = new THREE.Vector3();
    camera.getWorldDirection(fwd);
    fwd.y = 0; fwd.normalize();

    const right = new THREE.Vector3();
    right.crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();

    const move = new THREE.Vector3();
    if (k.forward)  move.add(fwd);
    if (k.backward) move.sub(fwd);
    if (k.right)    move.add(right);
    if (k.left)     move.sub(right);

    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(this.speed * dt);
      this.velocity.add(move);
    }

    this.velocity.multiplyScalar(this.damping);
    // Only move in XZ — Y stays 0 (ground)
    this.group.position.x += this.velocity.x;
    this.group.position.z += this.velocity.z;

    // Rotate character to face movement direction
    if (this.velocity.lengthSq() > 0.002) {
      const targetAngle = Math.atan2(this.velocity.x, this.velocity.z);
      let diff = targetAngle - this.group.rotation.y;
      // Normalise angle diff to [-π, π]
      while (diff >  Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.group.rotation.y += diff * 0.14;
    }
  }

  // ─── Walk animation ──────────────────────────────────────────────────────

  _animate(t) {
    const isMoving = this.velocity.lengthSq() > 0.005;
    const freq = 5.5;
    const legAmp = 0.52, armAmp = 0.38;

    if (isMoving) {
      this.leftLegPivot.rotation.x  =  Math.sin(t * freq) * legAmp;
      this.rightLegPivot.rotation.x = -Math.sin(t * freq) * legAmp;
      this.leftArmPivot.rotation.x  = -Math.sin(t * freq) * armAmp;
      this.rightArmPivot.rotation.x =  Math.sin(t * freq) * armAmp;
    } else {
      // Ease back to rest
      this.leftLegPivot.rotation.x  *= 0.84;
      this.rightLegPivot.rotation.x *= 0.84;
      this.leftArmPivot.rotation.x  *= 0.84;
      this.rightArmPivot.rotation.x *= 0.84;
    }

    // Subtle idle bob
    this.group.position.y = Math.sin(t * 1.9) * 0.022;
  }
}
