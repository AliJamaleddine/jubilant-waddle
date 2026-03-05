/**
 * scene.js — Minimalist white world.
 * The background is a clean warm white void.
 * Only sparse dust particles give a sense of infinite space.
 */

class SceneManager {
  constructor(canvas) {
    this.canvas = canvas;

    this._buildRenderer();
    this._buildCamera();
    this._buildLights();
    this._buildDust();

    this.scene = new THREE.Scene();
    // Warm white fog — softens the edges of the white void
    this.scene.fog = new THREE.FogExp2(0xf2efe8, 0.007);

    this.scene.add(this.dustMesh);

    window.addEventListener('resize', this._onResize.bind(this));
  }

  // ─── Build ───────────────────────────────────────────────────────────────

  _buildRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas:    this.canvas,
      antialias: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    // Warm white: like sunlit paper
    this.renderer.setClearColor(0xf2efe8, 1);
  }

  _buildCamera() {
    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      800
    );
    this.camera.position.set(0, 8, 50);
    this.camera.lookAt(0, 0, 0);
  }

  _buildLights() {
    // Bright flat ambient — no drama in the base world
    this.ambientLight = new THREE.AmbientLight(0xffffff, 3.0);
    // Warm directional light, very soft
    this.dirLight = new THREE.DirectionalLight(0xfff8f0, 0.6);
    this.dirLight.position.set(30, 60, 20);
  }

  _buildDust() {
    // 600 tiny pale dust motes give depth to the white void
    const count     = 600;
    const positions = new Float32Array(count * 3);
    const sizes     = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      positions[i*3]   = (Math.random() - 0.5) * 240;
      positions[i*3+1] = (Math.random() - 0.5) * 100;
      positions[i*3+2] = (Math.random() - 0.5) * 240;
      sizes[i]         = 0.6 + Math.random() * 1.8;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('size',     new THREE.BufferAttribute(sizes, 1));

    this._dustMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime:      { value: 0 },
        uPixelRatio:{ value: Math.min(window.devicePixelRatio, 2) },
      },
      vertexShader: `
        attribute float size;
        uniform float uTime;
        uniform float uPixelRatio;

        void main() {
          vec3 pos = position;
          // Slow organic drift
          pos.y += sin(uTime * 0.18 + position.x * 0.05) * 0.5;
          pos.x += cos(uTime * 0.14 + position.z * 0.04) * 0.3;

          vec4 mvPos    = modelViewMatrix * vec4(pos, 1.0);
          gl_Position   = projectionMatrix * mvPos;
          gl_PointSize  = size * uPixelRatio * (60.0 / -mvPos.z);
        }
      `,
      fragmentShader: `
        void main() {
          vec2  uv   = gl_PointCoord - 0.5;
          float dist = length(uv);
          if (dist > 0.5) discard;
          // Very faint — just enough to feel depth
          float alpha = smoothstep(0.5, 0.0, dist) * 0.12;
          gl_FragColor = vec4(0.55, 0.52, 0.48, alpha);
        }
      `,
      transparent: true,
      depthWrite:  false,
    });

    this.dustMesh = new THREE.Points(geo, this._dustMat);
  }

  // ─── Update / Render ─────────────────────────────────────────────────────

  update(t) {
    this._dustMat.uniforms.uTime.value = t;
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
}
