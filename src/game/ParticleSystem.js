import * as THREE from 'three';
import { createCircleTexture } from './utils.js';

export class ParticleSystem {
  constructor(scene, settings) {
    this.scene = scene;
    this.settings = settings;
    this.ambientMax = 620;
    this.puffMax = 260;
    this.tracerMax = 96;
    this.ambient = [];
    this.puffs = [];
    this.tracers = [];

    this.createAmbientDust();
    this.createPuffPool();
    this.createTracerPool();
    this.applySettings(settings.values);
  }

  createAmbientDust() {
    this.ambientPositions = new Float32Array(this.ambientMax * 3);
    this.ambientColors = new Float32Array(this.ambientMax * 3);
    this.ambientGeometry = new THREE.BufferGeometry();
    this.ambientGeometry.setAttribute('position', new THREE.BufferAttribute(this.ambientPositions, 3));
    this.ambientGeometry.setAttribute('color', new THREE.BufferAttribute(this.ambientColors, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.22,
      transparent: true,
      opacity: 0.36,
      map: createCircleTexture('rgba(226,206,168,0.86)'),
      vertexColors: true,
      depthWrite: false
    });
    this.ambientPoints = new THREE.Points(this.ambientGeometry, mat);
    this.ambientPoints.frustumCulled = false;
    this.scene.add(this.ambientPoints);
    for (let i = 0; i < this.ambientMax; i += 1) {
      this.ambient.push({
        x: 0,
        y: 0,
        z: 0,
        drift: new THREE.Vector3((Math.random() - 0.5) * 0.08, 0.02 + Math.random() * 0.04, (Math.random() - 0.5) * 0.08)
      });
    }
  }

  createPuffPool() {
    this.puffPositions = new Float32Array(this.puffMax * 3);
    this.puffColors = new Float32Array(this.puffMax * 3);
    this.puffGeometry = new THREE.BufferGeometry();
    this.puffGeometry.setAttribute('position', new THREE.BufferAttribute(this.puffPositions, 3));
    this.puffGeometry.setAttribute('color', new THREE.BufferAttribute(this.puffColors, 3));
    this.puffGeometry.setDrawRange(0, 0);
    const mat = new THREE.PointsMaterial({
      size: 0.46,
      transparent: true,
      opacity: 0.5,
      map: createCircleTexture('rgba(207,184,143,0.78)'),
      vertexColors: true,
      depthWrite: false
    });
    this.puffPoints = new THREE.Points(this.puffGeometry, mat);
    this.puffPoints.frustumCulled = false;
    this.scene.add(this.puffPoints);

    for (let i = 0; i < this.puffMax; i += 1) {
      this.puffs.push({
        active: false,
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        life: 0,
        maxLife: 1
      });
    }
  }

  createTracerPool() {
    this.tracerPositions = new Float32Array(this.tracerMax * 2 * 3);
    this.tracerColors = new Float32Array(this.tracerMax * 2 * 3);
    this.tracerGeometry = new THREE.BufferGeometry();
    this.tracerGeometry.setAttribute('position', new THREE.BufferAttribute(this.tracerPositions, 3));
    this.tracerGeometry.setAttribute('color', new THREE.BufferAttribute(this.tracerColors, 3));
    this.tracerGeometry.setDrawRange(0, 0);
    const mat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.74,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.tracerLines = new THREE.LineSegments(this.tracerGeometry, mat);
    this.tracerLines.frustumCulled = false;
    this.scene.add(this.tracerLines);

    for (let i = 0; i < this.tracerMax; i += 1) {
      this.tracers.push({
        active: false,
        start: new THREE.Vector3(),
        end: new THREE.Vector3(),
        life: 0,
        maxLife: 0.08
      });
    }
  }

  applySettings(values) {
    this.dustCount = Math.floor(this.ambientMax * (values.dustDensity ?? 0.7));
    this.ambientGeometry.setDrawRange(0, this.dustCount);
  }

  seedAround(position) {
    for (let i = 0; i < this.ambientMax; i += 1) {
      const p = this.ambient[i];
      p.x = position.x + (Math.random() - 0.5) * 68;
      p.y = 0.4 + Math.random() * 8.5;
      p.z = position.z + (Math.random() - 0.5) * 60;
    }
  }

  spawnImpactDust(position, normal = new THREE.Vector3(0, 1, 0), amount = 10) {
    for (let i = 0; i < amount; i += 1) {
      const puff = this.getPuff();
      if (!puff) return;
      puff.active = true;
      puff.position.copy(position).addScaledVector(normal, 0.08);
      const tangent = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.55, Math.random() - 0.5).normalize();
      puff.velocity.copy(normal).multiplyScalar(0.5 + Math.random() * 1.1).addScaledVector(tangent, Math.random() * 1.4);
      puff.life = 0;
      puff.maxLife = 0.45 + Math.random() * 0.65;
    }
  }

  spawnFootDust(position, sprint = false) {
    const amount = sprint ? 5 : 2;
    for (let i = 0; i < amount; i += 1) {
      const puff = this.getPuff();
      if (!puff) return;
      puff.active = true;
      puff.position.copy(position);
      puff.position.y = 0.08;
      puff.velocity.set((Math.random() - 0.5) * 0.8, 0.2 + Math.random() * 0.35, (Math.random() - 0.5) * 0.8);
      puff.life = 0;
      puff.maxLife = 0.32 + Math.random() * 0.36;
    }
  }

  spawnTracer(start, end) {
    const tracer = this.tracers.find((item) => !item.active) ?? this.tracers[0];
    tracer.active = true;
    tracer.start.copy(start);
    tracer.end.copy(end);
    tracer.life = 0;
  }

  getPuff() {
    return this.puffs.find((p) => !p.active) ?? null;
  }

  update(dt, playerPosition) {
    this.updateAmbient(dt, playerPosition);
    this.updatePuffs(dt);
    this.updateTracers(dt);
  }

  updateAmbient(dt, playerPosition) {
    for (let i = 0; i < this.dustCount; i += 1) {
      const p = this.ambient[i];
      p.x += p.drift.x * dt;
      p.y += p.drift.y * dt;
      p.z += p.drift.z * dt;
      if (Math.abs(p.x - playerPosition.x) > 35 || Math.abs(p.z - playerPosition.z) > 31 || p.y > 9.5) {
        p.x = playerPosition.x + (Math.random() - 0.5) * 62;
        p.y = 0.3 + Math.random() * 5.8;
        p.z = playerPosition.z + (Math.random() - 0.5) * 58;
      }
      const index = i * 3;
      this.ambientPositions[index] = p.x;
      this.ambientPositions[index + 1] = p.y;
      this.ambientPositions[index + 2] = p.z;
      const tint = 0.55 + Math.random() * 0.08;
      this.ambientColors[index] = tint;
      this.ambientColors[index + 1] = tint * 0.9;
      this.ambientColors[index + 2] = tint * 0.68;
    }
    this.ambientGeometry.attributes.position.needsUpdate = true;
    this.ambientGeometry.attributes.color.needsUpdate = true;
  }

  updatePuffs(dt) {
    let count = 0;
    for (const puff of this.puffs) {
      if (!puff.active) continue;
      puff.life += dt;
      if (puff.life >= puff.maxLife) {
        puff.active = false;
        continue;
      }
      puff.velocity.y += 0.18 * dt;
      puff.velocity.multiplyScalar(1 - dt * 0.9);
      puff.position.addScaledVector(puff.velocity, dt);

      const fade = 1 - puff.life / puff.maxLife;
      const index = count * 3;
      this.puffPositions[index] = puff.position.x;
      this.puffPositions[index + 1] = puff.position.y;
      this.puffPositions[index + 2] = puff.position.z;
      this.puffColors[index] = 0.72 * fade;
      this.puffColors[index + 1] = 0.63 * fade;
      this.puffColors[index + 2] = 0.46 * fade;
      count += 1;
    }
    this.puffGeometry.setDrawRange(0, count);
    this.puffGeometry.attributes.position.needsUpdate = true;
    this.puffGeometry.attributes.color.needsUpdate = true;
  }

  updateTracers(dt) {
    let count = 0;
    for (const tracer of this.tracers) {
      if (!tracer.active) continue;
      tracer.life += dt;
      if (tracer.life >= tracer.maxLife) {
        tracer.active = false;
        continue;
      }
      const fade = 1 - tracer.life / tracer.maxLife;
      const base = count * 6;
      this.tracerPositions[base] = tracer.start.x;
      this.tracerPositions[base + 1] = tracer.start.y;
      this.tracerPositions[base + 2] = tracer.start.z;
      this.tracerPositions[base + 3] = tracer.end.x;
      this.tracerPositions[base + 4] = tracer.end.y;
      this.tracerPositions[base + 5] = tracer.end.z;
      for (let i = 0; i < 2; i += 1) {
        const ci = base + i * 3;
        this.tracerColors[ci] = 1 * fade;
        this.tracerColors[ci + 1] = 0.78 * fade;
        this.tracerColors[ci + 2] = 0.32 * fade;
      }
      count += 1;
    }
    this.tracerGeometry.setDrawRange(0, count * 2);
    this.tracerGeometry.attributes.position.needsUpdate = true;
    this.tracerGeometry.attributes.color.needsUpdate = true;
  }
}
