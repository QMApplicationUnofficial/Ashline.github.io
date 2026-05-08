import * as THREE from 'three';

export class DecalManager {
  constructor(scene) {
    this.scene = scene;
    this.max = 90;
    this.index = 0;
    this.decals = [];
    this.material = this.createMaterial();

    for (let i = 0; i < this.max; i += 1) {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.38), this.material);
      mesh.visible = false;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.decals.push(mesh);
    }
  }

  createMaterial() {
    const canvas = document.createElement('canvas');
    canvas.width = 96;
    canvas.height = 96;
    const ctx = canvas.getContext('2d');
    const g = ctx.createRadialGradient(48, 48, 0, 48, 48, 43);
    g.addColorStop(0, 'rgba(38,29,23,0.8)');
    g.addColorStop(0.42, 'rgba(45,34,26,0.35)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 96, 96);
    for (let i = 0; i < 18; i += 1) {
      ctx.strokeStyle = `rgba(28,22,17,${0.12 + Math.random() * 0.2})`;
      ctx.lineWidth = 1 + Math.random() * 2;
      ctx.beginPath();
      ctx.moveTo(48, 48);
      const angle = Math.random() * Math.PI * 2;
      const radius = 8 + Math.random() * 28;
      ctx.lineTo(48 + Math.cos(angle) * radius, 48 + Math.sin(angle) * radius);
      ctx.stroke();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1
    });
  }

  add(position, normal = new THREE.Vector3(0, 1, 0), scale = 1) {
    const decal = this.decals[this.index];
    this.index = (this.index + 1) % this.max;
    decal.visible = true;
    decal.scale.setScalar(scale * (0.72 + Math.random() * 0.55));
    decal.position.copy(position).addScaledVector(normal, 0.024);

    const look = position.clone().add(normal);
    decal.lookAt(look);
    decal.rotateZ(Math.random() * Math.PI * 2);
  }
}
