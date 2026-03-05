/**
 * portal.js — A standing oval portal.
 *
 * Structure (all in local XY plane, group stands upright):
 *   · Outer glow ring  — large TorusGeometry, low opacity
 *   · Main ring        — TorusGeometry with flowing energy shader
 *   · Inner face       — PlaneGeometry with swirling portal shader
 *   · Particle ring    — Points orbiting the rim
 *
 * The group is scaled (1, 1.35, 1) to turn the circle into an oval.
 * It faces a given direction via group.rotation.y.
 */

class Portal {
  /**
   * @param {object} cfg
   * @param {string}         cfg.name
   * @param {string}         cfg.color      — hex string, e.g. '#00bcd4'
   * @param {THREE.Vector3}  cfg.position   — centre of oval on ground = Y of group
   * @param {number}         cfg.facingY    — group.rotation.y (radians)
   * @param {object[]}       cfg.photos     — [{url, caption}, …]
   */
  constructor(cfg) {
    this.name    = cfg.name;
    this.color   = new THREE.Color(cfg.color);
    this.photos  = cfg.photos || [];

    this._prox   = 0;   // animated proximity [0..1]

    // Root group — centred at mid-oval height, turned oval by Y scale
    this.group = new THREE.Group();
    this.group.position.copy(cfg.position);
    this.group.rotation.y = cfg.facingY || 0;
    this.group.scale.set(1, 1.35, 1);

    this._buildGlowRing();
    this._buildMainRing();
    this._buildInnerFace();
    this._buildParticles();
  }

  // ─── Builders ────────────────────────────────────────────────────────────

  _buildGlowRing() {
    // Slightly larger, very transparent — gives the bloom halo feel
    const geo = new THREE.TorusGeometry(2.18, 0.22, 8, 80);
    const mat = new THREE.MeshBasicMaterial({
      color: this.color,
      transparent: true,
      opacity: 0.18,
    });
    this._glowMesh = new THREE.Mesh(geo, mat);
    this._glowMat  = mat;
    this.group.add(this._glowMesh);
  }

  _buildMainRing() {
    const geo = new THREE.TorusGeometry(2.0, 0.1, 16, 100);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime:      { value: 0 },
        uColor:     { value: this.color.clone() },
        uProximity: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3  uColor;
        uniform float uProximity;
        varying vec2  vUv;

        void main() {
          // uv.x flows around the ring (0→1 = full circumference)
          float flow    = sin((vUv.x - uTime * 0.35) * 6.2832 * 6.0) * 0.5 + 0.5;
          float sparkle = pow(flow, 7.0);
          float pulse   = sin(uTime * 2.5 + vUv.x * 18.85) * 0.5 + 0.5;

          vec3 col = uColor;
          col += uColor  * sparkle * 0.9;
          col += vec3(1.0) * sparkle * 0.25;       // white flash
          col *= 1.0 + uProximity * 0.55;
          col  = clamp(col, 0.0, 2.0);

          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    this._ringMesh = new THREE.Mesh(geo, mat);
    this._ringMat  = mat;
    this.group.add(this._ringMesh);
  }

  _buildInnerFace() {
    // Square plane — the shader clips it to a circle in UV space.
    // Because the group is scaled (1, 1.35, 1) the circle becomes an oval.
    const geo = new THREE.PlaneGeometry(3.9, 3.9, 1, 1);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime:      { value: 0 },
        uColor:     { value: this.color.clone() },
        uProximity: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3  uColor;
        uniform float uProximity;
        varying vec2  vUv;

        void main() {
          vec2  uv   = vUv * 2.0 - 1.0;      // [-1, 1]
          float r    = length(uv);
          if (r > 0.94) discard;              // circular clip

          float edge = smoothstep(0.94, 0.68, r);

          float angle = atan(uv.y, uv.x);

          // Two contra-rotating swirl layers
          float s1 = sin(angle * 4.0 + uTime * 1.6 - r * 5.5) * 0.5 + 0.5;
          float s2 = cos(angle * 3.0 - uTime * 1.0 + r * 4.0) * 0.5 + 0.5;
          float energy = s1 * 0.6 + s2 * 0.4;

          // Bright core
          float core = exp(-r * r * 3.8);

          vec3 col = uColor * (0.35 + energy * 0.75);
          col = mix(col, vec3(1.0), core * 0.28);
          col *= 1.0 + uProximity * 0.4;

          float alpha = edge * (0.38 + energy * 0.44 + core * 0.18);
          alpha       = clamp(alpha * (0.78 + uProximity * 0.22), 0.0, 1.0);

          gl_FragColor = vec4(col, alpha);
        }
      `,
      transparent: true,
      depthWrite:  false,
      side: THREE.DoubleSide,
    });
    this._faceMesh = new THREE.Mesh(geo, mat);
    this._faceMat  = mat;
    this._faceMesh.position.z = 0.01; // tiny offset in front of ring centre
    this.group.add(this._faceMesh);
  }

  _buildParticles() {
    const count     = 160;
    const positions = new Float32Array(count * 3);
    const speeds    = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const r     = 2.05 + (Math.random() - 0.5) * 0.18;
      positions[i*3]   = Math.cos(angle) * r;
      positions[i*3+1] = Math.sin(angle) * r;
      positions[i*3+2] = (Math.random() - 0.5) * 0.12;
      speeds[i]        = 0.55 + Math.random() * 0.9;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('pSpeed',   new THREE.BufferAttribute(speeds, 1));

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime:      { value: 0 },
        uColor:     { value: this.color.clone() },
        uProximity: { value: 0 },
        uPixelRatio:{ value: Math.min(window.devicePixelRatio, 2) },
      },
      vertexShader: `
        attribute float pSpeed;
        uniform float   uTime;
        uniform float   uProximity;
        uniform float   uPixelRatio;

        void main() {
          // Each particle orbits; speed varies per particle
          float base  = atan(position.y, position.x);
          float r     = length(position.xy);
          float angle = base + uTime * pSpeed * 0.45;

          vec3 pos = vec3(
            cos(angle) * r,
            sin(angle) * r,
            position.z
          );
          // Proximity: particles spread outward slightly
          pos.xy *= 1.0 + uProximity * 0.1;

          vec4 mvPos   = modelViewMatrix * vec4(pos, 1.0);
          gl_Position  = projectionMatrix * mvPos;

          float sz = 1.4 + sin(angle * 9.0 + uTime * 4.0) * 0.7;
          sz *= 1.0 + uProximity * 0.6;
          gl_PointSize = sz * uPixelRatio * (55.0 / -mvPos.z);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;

        void main() {
          vec2  uv = gl_PointCoord - 0.5;
          float d  = length(uv);
          if (d > 0.5) discard;
          float a  = smoothstep(0.5, 0.0, d);
          gl_FragColor = vec4(uColor * 1.1, a);
        }
      `,
      transparent: true,
      depthWrite:  false,
    });

    this._partMesh = new THREE.Points(geo, mat);
    this._partMat  = mat;
    this._partMesh.frustumCulled = false;
    this.group.add(this._partMesh);
  }

  // ─── Update ──────────────────────────────────────────────────────────────

  update(t, proximity) {
    this._prox += (proximity - this._prox) * 0.06;
    const p = this._prox;

    this._ringMat.uniforms.uTime.value      = t;
    this._ringMat.uniforms.uProximity.value = p;

    this._faceMat.uniforms.uTime.value      = t;
    this._faceMat.uniforms.uProximity.value = p;

    this._partMat.uniforms.uTime.value      = t;
    this._partMat.uniforms.uProximity.value = p;

    this._glowMat.opacity = 0.14 + p * 0.22;
    this._glowMesh.scale.setScalar(1 + p * 0.06);
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  /** XZ distance from a world-space point to this portal */
  distanceXZ(point) {
    const dx = point.x - this.group.position.x;
    const dz = point.z - this.group.position.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  dispose() {
    [this._ringMat, this._faceMat, this._partMat, this._glowMat].forEach(m => m.dispose());
    [this._ringMesh, this._faceMesh, this._partMesh, this._glowMesh].forEach(m => m.geometry.dispose());
  }
}
