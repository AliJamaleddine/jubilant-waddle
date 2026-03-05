/**
 * galaxy.js — Visually complex themed galaxy objects.
 * Each theme has a unique particle distribution, color palette, and extras.
 *
 * Themes:
 *   mountains — terrain height field, alpine palette
 *   ocean     — flat disc with wave displacement, deep-sea to foam
 *   portraits — gaussian clusters (crowds), warm human palette
 *   cities    — vertical grid (buildings), steel & neon
 *   forest    — trunks + layered canopy ellipsoids, green gradient
 */

class Galaxy {
  /**
   * @param {object} config
   * @param {string} config.name
   * @param {string} config.theme        'mountains'|'ocean'|'portraits'|'cities'|'forest'
   * @param {THREE.Vector3} config.position
   * @param {string[]} config.colors     hex palette, low-to-high or inner-to-outer
   * @param {number}  config.radius
   * @param {number}  config.particleCount
   * @param {number}  config.rotSpeed   rotation speed multiplier (default 0.05)
   * @param {object[]} config.photos
   */
  constructor(config) {
    this.name          = config.name;
    this.theme         = config.theme || 'mountains';
    this.colors        = config.colors;
    this.radius        = config.radius || 9;
    this.particleCount = config.particleCount || 5000;
    this.rotSpeed      = config.rotSpeed !== undefined ? config.rotSpeed : 0.05;
    this.photos        = config.photos || [];
    // Accent color for CSS label rule (first saturated color in palette)
    this.accentHex     = config.colors[Math.floor(config.colors.length / 2)];

    this._proximity    = 0;

    this.group = new THREE.Group();
    this.group.position.copy(config.position);

    this._buildParticles();
    this._buildCore();
    this._buildExtras();

    // Label offset: above the mass of particles
    this.labelOffset = new THREE.Vector3(0, this.radius * 0.72, 0);
  }

  // ─── Particle builder (dispatches by theme) ──────────────────────────────

  _buildParticles() {
    const count     = this.particleCount;
    const positions = new Float32Array(count * 3);
    const pColors   = new Float32Array(count * 3);
    const sizes     = new Float32Array(count);

    switch (this.theme) {
      case 'mountains': this._genMountains(count, positions, pColors, sizes); break;
      case 'ocean':     this._genOcean(count, positions, pColors, sizes);     break;
      case 'portraits': this._genPortraits(count, positions, pColors, sizes); break;
      case 'cities':    this._genCities(count, positions, pColors, sizes);    break;
      case 'forest':    this._genForest(count, positions, pColors, sizes);    break;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color',    new THREE.BufferAttribute(pColors, 3));
    geo.setAttribute('size',     new THREE.BufferAttribute(sizes, 1));

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime:      { value: 0 },
        uProximity: { value: 0 },
        uRotSpeed:  { value: this.rotSpeed },
        uPixelRatio:{ value: Math.min(window.devicePixelRatio, 2) },
      },
      vertexShader: `
        attribute float size;
        attribute vec3  color;
        varying   vec3  vColor;
        uniform   float uTime;
        uniform   float uProximity;
        uniform   float uRotSpeed;
        uniform   float uPixelRatio;

        void main() {
          vColor = color;

          // Slow rotation around Y — each theme controls speed via uRotSpeed
          float angle = uTime * uRotSpeed;
          float sinA  = sin(angle);
          float cosA  = cos(angle);
          vec3  pos   = vec3(
            position.x * cosA - position.z * sinA,
            position.y,
            position.x * sinA + position.z * cosA
          );

          // On proximity: particles breathe outward very slightly
          pos.xz *= 1.0 + uProximity * 0.05;

          vec4 mvPos   = modelViewMatrix * vec4(pos, 1.0);
          gl_Position  = projectionMatrix * mvPos;

          float baseSize = size * (1.0 + uProximity * 0.45);
          gl_PointSize   = baseSize * uPixelRatio * (200.0 / -mvPos.z);
        }
      `,
      fragmentShader: `
        varying vec3  vColor;
        uniform float uProximity;

        void main() {
          vec2  uv   = gl_PointCoord - 0.5;
          float dist = length(uv);
          if (dist > 0.5) discard;

          float alpha = smoothstep(0.5, 0.05, dist);
          // Slightly brighten on proximity
          vec3  col   = vColor * (1.0 + uProximity * 0.25);
          gl_FragColor = vec4(col, alpha * 0.92);
        }
      `,
      transparent:  true,
      depthWrite:   false,
      // NormalBlending so particles are VISIBLE on the white background
      blending:     THREE.NormalBlending,
      vertexColors: true,
    });

    this.particles    = new THREE.Points(geo, mat);
    this._particleMat = mat;
    this.group.add(this.particles);
  }

  // ─── Theme generators ────────────────────────────────────────────────────

  /**
   * Helper: interpolate between palette colors at position t ∈ [0,1]
   */
  _colorAt(t, cols) {
    const clamped = Math.max(0, Math.min(1, t));
    const cIdx    = Math.min(Math.floor(clamped * (cols.length - 1)), cols.length - 2);
    const cFrac   = clamped * (cols.length - 1) - cIdx;
    return cols[cIdx].clone().lerp(cols[cIdx + 1], cFrac);
  }

  /**
   * MOUNTAINS — terrain height field using sum-of-sines pseudo-noise.
   * Palette: dark rock → mid stone → light stone → snow.
   */
  _genMountains(count, positions, pColors, sizes) {
    const cols = this.colors.map(c => new THREE.Color(c));

    // Sum-of-sines "noise" — fast, no imports needed
    const h = (x, z) =>
        Math.sin(x * 0.65) * Math.cos(z * 0.50) * 2.8
      + Math.sin(x * 1.40 + 0.9) * Math.cos(z * 1.10 + 0.3) * 1.5
      + Math.sin(x * 2.70 + 1.8) * Math.cos(z * 2.30 + 1.2) * 0.6
      + Math.sin(x * 0.28 + 3.1) * Math.cos(z * 0.33 + 2.2) * 3.2;

    const maxH = this.radius * 0.85;

    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * this.radius * 2.4;
      const z = (Math.random() - 0.5) * this.radius * 2.4;
      const hv = h(x, z);
      const y  = hv + (Math.random() - 0.5) * 0.55;

      positions[i*3]   = x + (Math.random() - 0.5) * 0.3;
      positions[i*3+1] = y;
      positions[i*3+2] = z + (Math.random() - 0.5) * 0.3;

      // Map height to palette (low = dark rock, high = snow/ice)
      const t   = THREE.MathUtils.clamp((hv + maxH) / (maxH * 2), 0, 1);
      const col = this._colorAt(t, cols);
      col.multiplyScalar(0.78 + Math.random() * 0.44);
      pColors[i*3]   = col.r;
      pColors[i*3+1] = col.g;
      pColors[i*3+2] = col.b;

      // Snowcap: smaller points at peaks
      sizes[i] = t > 0.78 ? 0.25 + Math.random() * 0.45 : 0.35 + Math.random() * 1.1;
    }
  }

  /**
   * OCEAN — flat disc with sine-wave surface + deep volume below.
   * Palette: deep navy → ocean blue → turquoise → foam white.
   */
  _genOcean(count, positions, pColors, sizes) {
    const cols = this.colors.map(c => new THREE.Color(c));

    // Frozen snapshot of surface waves
    const wave = (x, z) =>
        Math.sin(x * 0.55) * Math.cos(z * 0.48) * 0.45
      + Math.sin(x * 1.15 + 1.0) * Math.cos(z * 0.88) * 0.22
      + Math.sin(x * 0.30) * Math.cos(z * 1.55 + 0.5) * 0.28;

    for (let i = 0; i < count; i++) {
      // Disc distribution (more towards centre)
      const r = Math.sqrt(Math.random()) * this.radius;
      const a = Math.random() * Math.PI * 2;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const w = wave(x, z);

      const atSurface = Math.random() < 0.62;
      const y = atSurface
        ? w + (Math.random() - 0.5) * 0.38
        : w - Math.random() * 2.8 * (r / this.radius); // depth

      positions[i*3]   = x;
      positions[i*3+1] = y;
      positions[i*3+2] = z;

      // Surface = lighter, foam-like; deep = dark navy
      const t   = atSurface ? 0.55 + Math.random() * 0.45 : Math.random() * 0.4;
      const col = this._colorAt(t, cols);
      col.multiplyScalar(0.8 + Math.random() * 0.4);
      pColors[i*3]   = col.r;
      pColors[i*3+1] = col.g;
      pColors[i*3+2] = col.b;

      sizes[i] = atSurface ? 0.4 + Math.random() * 1.3 : 0.2 + Math.random() * 0.55;
    }
  }

  /**
   * PORTRAITS — gaussian clusters representing groups of people.
   * Palette: warm amber → rose → mauve → terracotta.
   */
  _genPortraits(count, positions, pColors, sizes) {
    const cols = this.colors.map(c => new THREE.Color(c));

    const clusters = [
      { cx:  0.0, cz:  0.0, w: 0.42, spread: 1.9 },
      { cx: -3.8, cz:  1.6, w: 0.18, spread: 1.1 },
      { cx:  3.2, cz: -2.1, w: 0.16, spread: 1.0 },
      { cx: -1.2, cz: -4.2, w: 0.12, spread: 0.85 },
      { cx:  4.5, cz:  3.2, w: 0.12, spread: 0.75 },
    ];

    // Box-Muller gaussian
    const gauss = () => {
      let u, v, s;
      do {
        u = Math.random() * 2 - 1;
        v = Math.random() * 2 - 1;
        s = u * u + v * v;
      } while (s >= 1 || s === 0);
      return u * Math.sqrt(-2 * Math.log(s) / s);
    };

    for (let i = 0; i < count; i++) {
      // Pick cluster by weight
      const rnd = Math.random();
      let acc = 0, cl = clusters[0];
      for (const c of clusters) { acc += c.w; if (rnd < acc) { cl = c; break; } }

      const x = cl.cx + gauss() * cl.spread;
      const z = cl.cz + gauss() * cl.spread;
      // Y = "height" — people are taller than wide, slight variation
      const maxH     = this.radius * 0.45;
      const y        = Math.random() * maxH - 0.1;

      positions[i*3]   = x;
      positions[i*3+1] = y;
      positions[i*3+2] = z;

      const t   = Math.random();
      const col = this._colorAt(t, cols);
      col.multiplyScalar(0.72 + Math.random() * 0.56);
      pColors[i*3]   = col.r;
      pColors[i*3+1] = col.g;
      pColors[i*3+2] = col.b;

      sizes[i] = 0.28 + Math.random() * 1.05;
    }
  }

  /**
   * CITIES — vertical grid of buildings.
   * Facade particles + brighter "window" particles near tops.
   * Palette: dark charcoal → steel blue → electric cyan → white.
   */
  _genCities(count, positions, pColors, sizes) {
    const cols = this.colors.map(c => new THREE.Color(c));

    const gridN    = 7;
    const cellSize = (this.radius * 1.85) / gridN;

    // Pre-generate building heights per cell
    const bh = Array.from({ length: gridN }, () =>
      Array.from({ length: gridN }, () =>
        Math.pow(Math.random(), 0.6) * this.radius * 0.88 + 0.5
      )
    );

    for (let i = 0; i < count; i++) {
      const gx = Math.floor(Math.random() * gridN);
      const gz = Math.floor(Math.random() * gridN);
      const H  = bh[gx][gz];

      const cx = (gx - gridN / 2 + 0.5) * cellSize;
      const cz = (gz - gridN / 2 + 0.5) * cellSize;
      const hw = cellSize * 0.36;

      let x, y, z;
      const onFace = Math.random() < 0.72;
      if (onFace) {
        const face = Math.floor(Math.random() * 4);
        y = Math.random() * H;
        if      (face === 0) { x = cx + hw; z = cz + (Math.random() - 0.5) * hw * 1.9; }
        else if (face === 1) { x = cx - hw; z = cz + (Math.random() - 0.5) * hw * 1.9; }
        else if (face === 2) { z = cz + hw; x = cx + (Math.random() - 0.5) * hw * 1.9; }
        else                 { z = cz - hw; x = cx + (Math.random() - 0.5) * hw * 1.9; }
      } else {
        // Rooftop
        x = cx + (Math.random() - 0.5) * cellSize * 0.7;
        z = cz + (Math.random() - 0.5) * cellSize * 0.7;
        y = H + Math.random() * 0.5;
      }

      positions[i*3]   = x;
      positions[i*3+1] = y;
      positions[i*3+2] = z;

      const heightT = y / H;
      const isWin   = onFace && Math.random() < 0.10 + heightT * 0.08;
      let col;
      if (isWin) {
        col = this._colorAt(0.82 + Math.random() * 0.18, cols);
        col.multiplyScalar(1.4); // windows glow brighter
      } else {
        col = this._colorAt(heightT * 0.55, cols);
        col.multiplyScalar(0.5 + Math.random() * 0.55);
      }
      pColors[i*3]   = col.r;
      pColors[i*3+1] = col.g;
      pColors[i*3+2] = col.b;

      sizes[i] = isWin ? 0.7 + Math.random() * 0.9 : 0.18 + Math.random() * 0.55;
    }
  }

  /**
   * FOREST — vertical trunks + layered canopy ellipsoids.
   * Palette: deep forest green → emerald → light lime → pale chartreuse.
   */
  _genForest(count, positions, pColors, sizes) {
    const cols = this.colors.map(c => new THREE.Color(c));

    // Scatter tree bases across the radius
    const treeCount = 90;
    const trees = Array.from({ length: treeCount }, () => {
      const r = Math.sqrt(Math.random()) * this.radius;
      const a = Math.random() * Math.PI * 2;
      return {
        x:       Math.cos(a) * r,
        z:       Math.sin(a) * r,
        height:  1.8 + Math.random() * this.radius * 0.65,
        canopyR: 0.55 + Math.random() * 1.6,
      };
    });

    for (let i = 0; i < count; i++) {
      const tree = trees[Math.floor(Math.random() * treeCount)];
      const onTrunk = Math.random() < 0.18;
      let x, y, z;

      if (onTrunk) {
        x = tree.x + (Math.random() - 0.5) * 0.14;
        z = tree.z + (Math.random() - 0.5) * 0.14;
        y = Math.random() * tree.height;
      } else {
        // Ellipsoidal canopy cluster at top of tree
        const angle = Math.random() * Math.PI * 2;
        const cr    = Math.sqrt(Math.random()) * tree.canopyR;
        x = tree.x + Math.cos(angle) * cr;
        z = tree.z + Math.sin(angle) * cr;
        // Canopy Y: slightly above trunk top, with vertical spread
        y = tree.height * 0.62 + Math.random() * tree.height * 0.52
          + (Math.random() - 0.5) * 0.45;
      }

      positions[i*3]   = x;
      positions[i*3+1] = y;
      positions[i*3+2] = z;

      const heightT = THREE.MathUtils.clamp(y / (tree.height * 1.15), 0, 1);
      const col     = this._colorAt(heightT, cols);
      col.multiplyScalar(0.72 + Math.random() * 0.52);
      pColors[i*3]   = col.r;
      pColors[i*3+1] = col.g;
      pColors[i*3+2] = col.b;

      sizes[i] = onTrunk ? 0.14 + Math.random() * 0.28 : 0.5 + Math.random() * 1.6;
    }
  }

  // ─── Core glow (center of each galaxy) ──────────────────────────────────

  _buildCore() {
    const accentCol = new THREE.Color(
      this.colors[Math.floor(this.colors.length / 2)]
    );

    // Central bright sphere
    const coreGeo = new THREE.SphereGeometry(0.55, 14, 14);
    const coreMat = new THREE.MeshBasicMaterial({
      color:       accentCol,
      transparent: true,
      opacity:     0.85,
      blending:    THREE.NormalBlending,
      depthWrite:  false,
    });
    this.core = new THREE.Mesh(coreGeo, coreMat);
    this.group.add(this.core);

    // Soft wide halo behind the core
    const haloGeo = new THREE.SphereGeometry(1.8, 10, 10);
    const haloMat = new THREE.MeshBasicMaterial({
      color:       accentCol,
      transparent: true,
      opacity:     0.06,
      blending:    THREE.NormalBlending,
      depthWrite:  false,
      side:        THREE.BackSide,
    });
    this.coreHalo = new THREE.Mesh(haloGeo, haloMat);
    this.group.add(this.coreHalo);
  }

  // ─── Theme extras (rings / halos specific to each theme) ─────────────────

  _buildExtras() {
    this._rings = [];
    switch (this.theme) {
      case 'ocean':    this._buildOceanRings();   break;
      case 'cities':   this._buildCityOrbit();    break;
      case 'forest':   this._buildForestCanopy(); break;
      // mountains, portraits: just the core, no extra rings
    }
  }

  _buildOceanRings() {
    // Two wide, nearly-flat rings = wave crests
    for (let r = 0; r < 2; r++) {
      const rIn  = this.radius * (0.35 + r * 0.3);
      const rOut = rIn + this.radius * 0.09;
      const geo  = new THREE.RingGeometry(rIn, rOut, 72);
      const mat  = new THREE.MeshBasicMaterial({
        color:       new THREE.Color(this.colors[2]),
        transparent: true,
        opacity:     0.13,
        blending:    THREE.NormalBlending,
        depthWrite:  false,
        side:        THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(geo, mat);
      ring.rotation.x = Math.PI * (0.05 + r * 0.04); // nearly flat
      this.group.add(ring);
      this._rings.push({ mesh: ring, speed: 0.004 + r * 0.002 });
    }
  }

  _buildCityOrbit() {
    // Thin tilted orbit circle = satellite / drone ring
    const geo = new THREE.RingGeometry(
      this.radius * 0.7,
      this.radius * 0.72,
      64
    );
    const mat = new THREE.MeshBasicMaterial({
      color:       new THREE.Color(this.colors[2]),
      transparent: true,
      opacity:     0.18,
      blending:    THREE.NormalBlending,
      depthWrite:  false,
      side:        THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(geo, mat);
    ring.rotation.x = Math.PI * 0.22;
    ring.rotation.z = 0.4;
    this.group.add(ring);
    this._rings.push({ mesh: ring, speed: 0.006 });
  }

  _buildForestCanopy() {
    // A wide soft disc = forest floor / canopy seen from above
    const geo = new THREE.CircleGeometry(this.radius * 0.85, 48);
    const mat = new THREE.MeshBasicMaterial({
      color:       new THREE.Color(this.colors[1]),
      transparent: true,
      opacity:     0.06,
      blending:    THREE.NormalBlending,
      depthWrite:  false,
      side:        THREE.DoubleSide,
    });
    const disc = new THREE.Mesh(geo, mat);
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = -0.5;
    this.group.add(disc);
    this._rings.push({ mesh: disc, speed: 0.002 });
  }

  // ─── Update (called every frame) ─────────────────────────────────────────

  update(dt, t, proximity) {
    // Smooth animated proximity value
    this._proximity += (proximity - this._proximity) * 0.05;

    // Shader uniforms
    this._particleMat.uniforms.uTime.value      = t;
    this._particleMat.uniforms.uProximity.value = this._proximity;

    // Core pulse
    const pulse = 0.8 + Math.sin(t * 1.3) * 0.18 + this._proximity * 0.35;
    this.core.material.opacity     = pulse * 0.88;
    this.core.scale.setScalar(1 + this._proximity * 0.28);
    this.coreHalo.material.opacity = 0.04 + this._proximity * 0.1;

    // Extras orbit
    for (const r of this._rings) {
      r.mesh.rotation.z += r.speed * (1 + this._proximity * 1.5);
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

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
