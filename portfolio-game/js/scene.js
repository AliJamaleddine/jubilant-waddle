/**
 * scene.js
 * Creates and manages the main Three.js scene:
 *  - Renderer setup
 *  - Camera
 *  - Lighting
 *  - Starfield background
 *  - Nebula particles
 *  - Resize handling
 */

class SceneManager {
  constructor(canvas) {
    this.canvas = canvas;

    this._buildRenderer();
    this._buildCamera();
    this._buildLights();
    this._buildStarfield();
    this._buildNebulaParticles();

    // Main scene
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x000005, 0.004);

    // Add background elements to scene
    this.scene.add(this.starfieldMesh);
    this.scene.add(this.nebulaMesh);

    window.addEventListener('resize', this._onResize.bind(this));
  }

  // ─── Build ───────────────────────────────────────────────────────────────

  _buildRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas:    this.canvas,
      antialias: true,
      alpha:     false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputEncoding  = THREE.sRGBEncoding;
    this.renderer.toneMapping     = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.setClearColor(0x000005, 1);
  }

  _buildCamera() {
    this.camera = new THREE.PerspectiveCamera(
      65,
      window.innerWidth / window.innerHeight,
      0.1,
      1200
    );
    // Camera is positioned behind/above the player; Universe moves it each frame
    this.camera.position.set(0, 8, 50);
    this.camera.lookAt(0, 0, 0);

    // Separate "rig" group so we can add offset without fighting the player
    this.cameraRig = new THREE.Group();
    this.cameraRig.add(this.camera);
  }

  _buildLights() {
    // Dim ambient so space feels dark
    this.ambientLight = new THREE.AmbientLight(0x0a0a1a, 1.2);

    // Cool directional "star" light
    this.dirLight = new THREE.DirectionalLight(0x8080ff, 0.5);
    this.dirLight.position.set(50, 80, -40);
  }

  _buildStarfield() {
    const starCount = 8000;
    const positions = new Float32Array(starCount * 3);
    const colors    = new Float32Array(starCount * 3);
    const sizes     = new Float32Array(starCount);

    // Star color palette: white, blue-white, slight amber, slight blue
    const palette = [
      new THREE.Color(1, 1, 1),
      new THREE.Color(0.85, 0.9, 1),
      new THREE.Color(1, 0.97, 0.85),
      new THREE.Color(0.7, 0.8, 1),
    ];

    for (let i = 0; i < starCount; i++) {
      // Distribute on a large sphere shell
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.acos(2 * Math.random() - 1);
      const r     = 400 + Math.random() * 300;

      positions[i*3]   = r * Math.sin(phi) * Math.cos(theta);
      positions[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i*3+2] = r * Math.cos(phi);

      const col        = palette[Math.floor(Math.random() * palette.length)];
      const brightness = 0.6 + Math.random() * 0.4;
      colors[i*3]      = col.r * brightness;
      colors[i*3+1]    = col.g * brightness;
      colors[i*3+2]    = col.b * brightness;

      sizes[i] = 0.4 + Math.random() * 1.6;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color',    new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('size',     new THREE.BufferAttribute(sizes, 1));

    this._starMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime:      { value: 0 },
        uPixelRatio:{ value: Math.min(window.devicePixelRatio, 2) },
      },
      vertexShader: `
        attribute float size;
        attribute vec3  color;
        varying   vec3  vColor;
        uniform   float uTime;
        uniform   float uPixelRatio;

        void main() {
          vColor = color;
          vec4 mvPos   = modelViewMatrix * vec4(position, 1.0);
          gl_Position  = projectionMatrix * mvPos;
          // Twinkle: each star gets a different phase via its x coordinate
          float twinkle  = sin(uTime * 1.8 + position.x * 0.01) * 0.5 + 0.5;
          gl_PointSize   = size * uPixelRatio * (1.0 + twinkle * 0.4);
        }
      `,
      fragmentShader: `
        varying vec3 vColor;

        void main() {
          vec2  uv   = gl_PointCoord - 0.5;
          float dist = length(uv);
          if (dist > 0.5) discard;
          float alpha = smoothstep(0.5, 0.05, dist);
          gl_FragColor = vec4(vColor, alpha);
        }
      `,
      transparent: true,
      depthWrite:  false,
      blending:    THREE.AdditiveBlending,
      vertexColors:true,
    });

    this.starfieldMesh = new THREE.Points(geo, this._starMat);
    // Starfield follows camera (attached in Universe after camera set up)
  }

  _buildNebulaParticles() {
    // Large, soft, colorful blobs in the far background
    const count     = 600;
    const positions = new Float32Array(count * 3);
    const colors    = new Float32Array(count * 3);
    const sizes     = new Float32Array(count);

    // Nebula palette: deep violets, magentas, teals
    const nebPalette = [
      new THREE.Color(0.25, 0.05, 0.5),
      new THREE.Color(0.05, 0.15, 0.4),
      new THREE.Color(0.4,  0.05, 0.3),
      new THREE.Color(0.05, 0.3,  0.45),
    ];

    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.acos(2 * Math.random() - 1);
      const r     = 80 + Math.random() * 200;

      positions[i*3]   = r * Math.sin(phi) * Math.cos(theta);
      positions[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i*3+2] = r * Math.cos(phi);

      const col      = nebPalette[Math.floor(Math.random() * nebPalette.length)];
      colors[i*3]    = col.r;
      colors[i*3+1]  = col.g;
      colors[i*3+2]  = col.b;
      sizes[i]       = 20 + Math.random() * 60;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color',    new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('size',     new THREE.BufferAttribute(sizes, 1));

    this._nebulaMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime:      { value: 0 },
        uPixelRatio:{ value: Math.min(window.devicePixelRatio, 2) },
      },
      vertexShader: `
        attribute float size;
        attribute vec3  color;
        varying   vec3  vColor;
        uniform   float uTime;
        uniform   float uPixelRatio;

        void main() {
          vColor = color;
          // Slow drift
          vec3 drifted = position;
          drifted.y += sin(uTime * 0.03 + position.x * 0.01) * 1.5;
          drifted.x += cos(uTime * 0.025 + position.z * 0.01) * 1.5;

          vec4 mvPos   = modelViewMatrix * vec4(drifted, 1.0);
          gl_Position  = projectionMatrix * mvPos;
          gl_PointSize = size * uPixelRatio;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;

        void main() {
          vec2  uv   = gl_PointCoord - 0.5;
          float dist = length(uv);
          if (dist > 0.5) discard;
          // Very soft Gaussian-ish falloff
          float alpha = exp(-dist * dist * 8.0) * 0.35;
          gl_FragColor = vec4(vColor, alpha);
        }
      `,
      transparent: true,
      depthWrite:  false,
      blending:    THREE.AdditiveBlending,
      vertexColors:true,
    });

    this.nebulaMesh = new THREE.Points(geo, this._nebulaMat);
  }

  // ─── Update ──────────────────────────────────────────────────────────────

  update(t) {
    this._starMat.uniforms.uTime.value   = t;
    this._nebulaMat.uniforms.uTime.value = t;
  }

  render(scene) {
    this.renderer.render(scene, this.camera);
  }

  // ─── Resize ──────────────────────────────────────────────────────────────

  _onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  addToScene(...objects) {
    for (const o of objects) this.scene.add(o);
  }
}
