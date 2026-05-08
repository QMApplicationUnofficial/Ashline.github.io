import * as THREE from 'three';

const SHADOW_MAPS = {
  low: 512,
  medium: 1024,
  high: 2048
};

export class Renderer3D {
  constructor(root, settings) {
    this.root = root;
    this.settings = settings;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xb9aa8c);
    this.scene.fog = new THREE.FogExp2(0xbda87e, 0.014);

    this.camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.08, 260);
    this.camera.rotation.order = 'YXZ';

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.domElement.className = 'webgl';
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.root.appendChild(this.renderer.domElement);

    this.ambient = new THREE.HemisphereLight(0xf4e9c7, 0x55483a, 1.8);
    this.scene.add(this.ambient);

    this.sun = new THREE.DirectionalLight(0xffe0a0, 3.2);
    this.sun.position.set(-32, 46, 22);
    this.sun.castShadow = true;
    this.sun.shadow.camera.left = -70;
    this.sun.shadow.camera.right = 70;
    this.sun.shadow.camera.top = 70;
    this.sun.shadow.camera.bottom = -70;
    this.sun.shadow.camera.near = 2;
    this.sun.shadow.camera.far = 130;
    this.sun.shadow.bias = -0.00018;
    this.scene.add(this.sun);

    this.resize = this.resize.bind(this);
    window.addEventListener('resize', this.resize);
    this.applySettings(settings.values);
  }

  applySettings(values) {
    const renderScale = values.renderScale ?? 1;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2) * renderScale);
    this.resize();

    const shadowSize = SHADOW_MAPS[values.shadowQuality] ?? SHADOW_MAPS.medium;
    this.sun.shadow.mapSize.set(shadowSize, shadowSize);
    if (this.sun.shadow.map) this.sun.shadow.map.dispose();
    this.sun.shadow.map = null;

    const preset = values.graphicsPreset ?? 'medium';
    this.scene.fog.density = preset === 'low' ? 0.01 : preset === 'high' ? 0.017 : 0.014;
  }

  resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    window.removeEventListener('resize', this.resize);
    this.renderer.dispose();
  }
}
