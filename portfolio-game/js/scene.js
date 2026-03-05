/**
 * scene.js — White minimal world.
 * Ground plane with a very subtle grid shader.
 * Bright flat lighting. No fog, no nebula.
 */

class SceneManager {
  constructor(canvas) {
    this.canvas = canvas;
    this._buildRenderer();
    this._buildCamera();
    this._buildLights();
    this._buildGround();

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf3f0e8);

    this.scene.add(this.ground);

    window.addEventListener('resize', this._onResize.bind(this));
  }

  // ─── Renderer ────────────────────────────────────────────────────────────

  _buildRenderer() {
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.setClearColor(0xf3f0e8, 1);
  }

  // ─── Camera ──────────────────────────────────────────────────────────────

  _buildCamera() {
    this.camera = new THREE.PerspectiveCamera(
      55, window.innerWidth / window.innerHeight, 0.1, 600
    );
    // Starting position — follows player from universe.js
    this.camera.position.set(0, 18, 30);
    this.camera.lookAt(0, 0, 0);
  }

  // ─── Lights ──────────────────────────────────────────────────────────────

  _buildLights() {
    // Bright, even ambient — the world feels clean and lit
    this.ambientLight = new THREE.AmbientLight(0xffffff, 2.8);
    // Soft warm directional — adds just a hint of depth on the figure
    this.dirLight = new THREE.DirectionalLight(0xfff5e4, 0.7);
    this.dirLight.position.set(20, 40, 15);
  }

  // ─── Ground ──────────────────────────────────────────────────────────────

  _buildGround() {
    const geo = new THREE.PlaneGeometry(400, 400, 1, 1);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uCamPos: { value: new THREE.Vector3() } },
      vertexShader: `
        varying vec3 vWorld;
        void main() {
          vec4 wp  = modelMatrix * vec4(position, 1.0);
          vWorld   = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        varying vec3 vWorld;
        uniform vec3 uCamPos;

        void main() {
          // Subtle grid every 5 units
          vec2  g    = abs(fract(vWorld.xz * 0.2) - 0.5);
          float line = min(g.x, g.y);
          float grid = 1.0 - smoothstep(0.0, 0.04, line);

          // Radial fade so grid disappears at horizon
          float dist = length(vWorld.xz - uCamPos.xz);
          float fade = 1.0 - smoothstep(30.0, 90.0, dist);

          vec3 base  = vec3(0.957, 0.941, 0.91);
          vec3 lineC = vec3(0.88, 0.865, 0.84);
          vec3 col   = mix(base, lineC, grid * fade * 0.55);

          gl_FragColor = vec4(col, 1.0);
        }
      `,
      side: THREE.FrontSide,
    });
    this.ground    = new THREE.Mesh(geo, mat);
    this.ground.rotation.x = -Math.PI / 2;
    this._groundMat = mat;
  }

  // ─── Update / Render ─────────────────────────────────────────────────────

  update() {
    // Pass camera position to ground shader so the grid fades at distance
    this._groundMat.uniforms.uCamPos.value.copy(this.camera.position);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  // ─── Resize ──────────────────────────────────────────────────────────────

  _onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }
}
