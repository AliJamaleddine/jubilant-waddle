/**
 * galaxy.js
 * Procedural spiral galaxy made of instanced particles + orbiting rings.
 * Each galaxy has a unique color palette and name.
 */

class Galaxy {
  /**
   * @param {object} config
   * @param {string} config.name        - Display name
   * @param {THREE.Vector3} config.position
   * @param {number[]} config.colors    - Array of hex colors for particles
   * @param {number} config.radius      - Galaxy disc radius
   * @param {number} config.particleCount
   * @param {string[]} config.photos    - Array of image URLs for the photo world
   * @param {number} config.armCount    - Spiral arms
   */
  constructor(config) {
    this.name         = config.name;
    this.colors       = config.colors;
    this.radius       = config.radius       || 8;
    this.particleCount= config.particleCount|| 4000;
    this.armCount     = config.armCount     || 3;
    this.photos       = config.photos       || [];

    // Interaction state
    this.isNear       = false;
    this.isActive     = false;   // player entered this galaxy
    this._proximity   = 0;       // 0-1 animated value

    // Groups
    this.group        = new THREE.Group();
    this.group.position.copy(config.position);

    this._time        = 0;
    this._buildParticles();
    this._buildCore();
    this._buildRings();
    this._buildLabel();
  }

  // ─── Build ───────────────────────────────────────────────────────────────

  _buildParticles() {
    const count  = this.particleCount;
    const colors = this.colors;

    // Positions, colors, sizes stored in Float32Arrays for instanced rendering
    const positions = new Float32Array(count * 3);
    const pColors   = new Float32Array(count * 3);
    const sizes     = new Float32Array(count);

    const colorObjects = colors.map(c => new THREE.Color(c));

    for (let i = 0; i < count; i++) {
      // Spiral galaxy distribution
      const arm       = Math.floor(Math.random() * this.armCount);
      const armAngle  = (arm / this.armCount) * Math.PI * 2;
      const dist      = Math.pow(Math.random(), 0.5) * this.radius;
      const spiral    = dist * 0.6; // how tight the spiral winds
      const angle     = armAngle + spiral + (Math.random() - 0.5) * 0.8;
      const scatter   = (1 - dist / this.radius) * 0.3 + 0.05;

      positions[i*3]   = Math.cos(angle) * dist + (Math.random()-0.5)*scatter*this.radius;
      positions[i*3+1] = (Math.random()-0.5) * this.radius * 0.08; // thin disc
      positions[i*3+2] = Math.sin(angle) * dist + (Math.random()-0.5)*scatter*this.radius;

      // Color: mix between palette entries based on distance
      const t     = dist / this.radius;
      const cIdx  = Math.min(Math.floor(t * (colorObjects.length-1)), colorObjects.length-2);
      const cFrac = (t * (colorObjects.length-1)) - cIdx;
      const col   = colorObjects[cIdx].clone().lerp(colorObjects[cIdx+1], cFrac);

      // Slight brightness variation
      col.multiplyScalar(0.7 + Math.random() * 0.6);
      pColors[i*3]   = col.r;
      pColors[i*3+1] = col.g;
      pColors[i*3+2] = col.b;

      sizes[i] = 0.3 + Math.random() * 1.2;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color',    new THREE.BufferAttribute(pColors, 3));
    geo.setAttribute('size',     new THREE.BufferAttribute(sizes, 1));

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime:      { value: 0 },
        uProximity: { value: 0 },
        uPixelRatio:{ value: Math.min(window.devicePixelRatio, 2) },
      },
      vertexShader: `
        attribute float size;
        attribute vec3  color;
        varying   vec3  vColor;
        uniform   float uTime;
        uniform   float uProximity;
        uniform   float uPixelRatio;

        void main() {
          vColor = color;

          // Subtle rotation of particles around Y axis
          float angle   = uTime * 0.08 + length(position.xz) * 0.04;
          float sinA    = sin(angle);
          float cosA    = cos(angle);
          vec3  rotated = vec3(
            position.x * cosA - position.z * sinA,
            position.y,
            position.x * sinA + position.z * cosA
          );

          // Proximity: particles breathe outward slightly
          rotated.xz *= 1.0 + uProximity * 0.06;

          vec4 mvPos = modelViewMatrix * vec4(rotated, 1.0);
          gl_Position  = projectionMatrix * mvPos;

          float baseSize = size * (1.0 + uProximity * 0.5);
          gl_PointSize   = baseSize * uPixelRatio * (200.0 / -mvPos.z);
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        uniform float uProximity;

        void main() {
          // Soft circular point
          vec2  uv   = gl_PointCoord - 0.5;
          float dist = length(uv);
          if (dist > 0.5) discard;

          float alpha = smoothstep(0.5, 0.1, dist);
          vec3  col   = vColor * (1.0 + uProximity * 0.6);

          gl_FragColor = vec4(col, alpha * 0.85);
        }
      `,
      transparent: true,
      depthWrite:  false,
      blending:    THREE.AdditiveBlending,
      vertexColors:true,
    });

    this.particles    = new THREE.Points(geo, mat);
    this._particleMat = mat;
    this.group.add(this.particles);
  }

  _buildCore() {
    // Bright central glow
    const geo = new THREE.SphereGeometry(0.8, 16, 16);
    const col = new THREE.Color(this.colors[0]);
    const mat = new THREE.MeshBasicMaterial({
      color:       col,
      transparent: true,
      opacity:     0.9,
      blending:    THREE.AdditiveBlending,
      depthWrite:  false,
    });
    this.core = new THREE.Mesh(geo, mat);
    this.group.add(this.core);

    // Larger diffuse halo
    const haloGeo = new THREE.SphereGeometry(2.2, 12, 12);
    const haloMat = new THREE.MeshBasicMaterial({
      color:       col,
      transparent: true,
      opacity:     0.08,
      blending:    THREE.AdditiveBlending,
      depthWrite:  false,
      side:        THREE.BackSide,
    });
    this.coreHalo = new THREE.Mesh(haloGeo, haloMat);
    this.group.add(this.coreHalo);
  }

  _buildRings() {
    // 2–3 orbiting dust rings at different tilt angles
    this._rings = [];
    const ringCount = 2 + Math.floor(Math.random());
    for (let r = 0; r < ringCount; r++) {
      const rInner = this.radius * (0.3 + r * 0.25);
      const rOuter = rInner + this.radius * 0.12;
      const geo    = new THREE.RingGeometry(rInner, rOuter, 64);
      const col    = new THREE.Color(this.colors[r % this.colors.length]);
      const mat    = new THREE.MeshBasicMaterial({
        color:       col,
        transparent: true,
        opacity:     0.12,
        blending:    THREE.AdditiveBlending,
        depthWrite:  false,
        side:        THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(geo, mat);
      ring.rotation.x = Math.PI * (0.3 + r * 0.2);
      ring.rotation.z = Math.random() * Math.PI;
      this.group.add(ring);
      this._rings.push({ mesh: ring, speed: 0.003 + Math.random() * 0.003 });
    }
  }

  _buildLabel() {
    // Label is a CSS element managed by Universe; nothing to do in Three.js here.
    // We expose a world position helper instead.
    this.labelOffset = new THREE.Vector3(0, this.radius * 0.55, 0);
  }

  // ─── Interaction ─────────────────────────────────────────────────────────

  /**
   * Call each frame from Universe.
   * @param {number} dt
   * @param {number} t  elapsed time
   * @param {number} proximity  0 = far, 1 = very close
   */
  update(dt, t, proximity) {
    this._time = t;

    // Smooth proximity animation value
    const target = proximity;
    this._proximity += (target - this._proximity) * 0.05;

    // Shader uniforms
    this._particleMat.uniforms.uTime.value      = t;
    this._particleMat.uniforms.uProximity.value = this._proximity;

    // Core pulse
    const pulse = 0.85 + Math.sin(t * 1.5) * 0.15 + this._proximity * 0.4;
    this.core.material.opacity = pulse * 0.9;
    this.core.scale.setScalar(1 + this._proximity * 0.3);
    this.coreHalo.material.opacity = 0.06 + this._proximity * 0.12;

    // Rotate whole galaxy slowly
    this.group.rotation.y += 0.0008 + this._proximity * 0.001;

    // Rings orbit
    for (const r of this._rings) {
      r.mesh.rotation.z += r.speed * (1 + this._proximity * 2);
    }
  }

  getLabelWorldPosition() {
    const pos = new THREE.Vector3();
    this.group.getWorldPosition(pos);
    pos.add(this.labelOffset);
    return pos;
  }

  dispose() {
    this.particles.geometry.dispose();
    this._particleMat.dispose();
    this.core.geometry.dispose();
    this.core.material.dispose();
  }
}
