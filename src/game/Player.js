import * as THREE from 'three';
import { clamp, resolveAabbCollisionXZ, rotateVector2 } from './utils.js';

export class Player {
  constructor(camera, input, map, settings, particles, audio) {
    this.camera = camera;
    this.input = input;
    this.map = map;
    this.settings = settings;
    this.particles = particles;
    this.audio = audio;
    this.position = map.attackerSpawn.clone();
    this.velocity = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.radius = 0.46;
    this.standHeight = 1.72;
    this.crouchHeight = 1.18;
    this.height = this.standHeight;
    this.grounded = true;
    this.health = 100;
    this.armor = 50;
    this.money = 800;
    this.alive = true;
    this.recoil = 0;
    this.shake = 0;
    this.footstepTimer = 0;
    this.damageFlash = 0;
    this.sprinting = false;
    this.smoothSpeed = 0;
    this.lastDamageFrom = new THREE.Vector3();
    this.camera.position.copy(this.position).add(new THREE.Vector3(0, this.height, 0));
  }

  reset(spawn = this.map.attackerSpawn) {
    this.position.copy(spawn);
    this.velocity.set(0, 0, 0);
    this.health = 100;
    this.armor = 50;
    this.alive = true;
    this.pitch = 0;
    this.yaw = 0;
    this.height = this.standHeight;
    this.grounded = true;
    this.damageFlash = 0;
  }

  update(dt) {
    if (!this.alive) return;
    this.updateLook(dt);
    this.updateMovement(dt);
    this.updateCamera(dt);
    this.damageFlash = Math.max(0, this.damageFlash - dt * 1.8);
  }

  updateLook(dt) {
    const mouse = this.input.consumeMouseDelta();
    const sensitivity = 0.0019 * this.settings.values.mouseSensitivity;
    this.yaw -= mouse.x * sensitivity;
    this.pitch -= mouse.y * sensitivity;
    this.pitch += this.recoil * dt * 12;
    this.recoil = Math.max(0, this.recoil - dt * 9);
    this.pitch = clamp(this.pitch, -1.45, 1.45);
  }

  updateMovement(dt) {
    const forward = Number(this.input.isDown('KeyW')) - Number(this.input.isDown('KeyS'));
    const strafe = Number(this.input.isDown('KeyD')) - Number(this.input.isDown('KeyA'));
    const crouching = this.input.isDown('ControlLeft') || this.input.isDown('ControlRight') || this.input.isDown('KeyC');
    const sprinting = this.input.isDown('ShiftLeft') && forward > 0 && !crouching;
    this.sprinting = sprinting;
    const targetHeight = crouching ? this.crouchHeight : this.standHeight;
    this.height += (targetHeight - this.height) * Math.min(1, dt * 12);

    const speed = crouching ? 3.0 : sprinting ? 7.0 : 4.65;
    let move = new THREE.Vector3();
    if (forward || strafe) {
      move = rotateVector2(strafe, -forward, this.yaw).normalize().multiplyScalar(speed);
    }

    this.velocity.x = move.x;
    this.velocity.z = move.z;
    this.velocity.y -= 18 * dt;
    if (this.grounded && this.input.consume('Space')) {
      this.velocity.y = 6.2;
      this.grounded = false;
    }

    const previous = this.position.clone();
    this.position.addScaledVector(this.velocity, dt);
    if (this.position.y <= 0) {
      this.position.y = 0;
      this.velocity.y = 0;
      this.grounded = true;
    }
    const resolved = resolveAabbCollisionXZ(this.position, previous, this.radius, this.map.colliders);
    this.position.x = resolved.x;
    this.position.z = resolved.z;

    const moving = move.lengthSq() > 0.1 && this.grounded;
    if (moving) {
      this.footstepTimer -= dt;
      if (this.footstepTimer <= 0) {
        this.footstepTimer = sprinting ? 0.25 : crouching ? 0.55 : 0.38;
        this.audio.footstep(sprinting);
        this.particles.spawnFootDust(this.position, sprinting);
      }
    } else {
      this.footstepTimer = 0;
    }
  }

  updateCamera(dt) {
    this.shake = Math.max(0, this.shake - dt * 6.5);
    const shakeX = (Math.random() - 0.5) * this.shake * 0.035;
    const shakeY = (Math.random() - 0.5) * this.shake * 0.035;
    this.camera.position.set(this.position.x + shakeX, this.position.y + this.height + shakeY, this.position.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0);
  }

  addRecoil(amount, shake = 0.45) {
    this.recoil += amount;
    this.shake = Math.max(this.shake, shake);
  }

  damage(amount, sourcePosition = null) {
    if (!this.alive) return;
    const armorAbsorb = Math.min(this.armor, amount * 0.45);
    this.armor -= armorAbsorb;
    this.health -= amount - armorAbsorb;
    this.damageFlash = 1;
    if (sourcePosition) this.lastDamageFrom.copy(sourcePosition);
    if (this.health <= 0) {
      this.health = 0;
      this.alive = false;
    }
  }

  getForward() {
    return new THREE.Vector3(0, 0, -1).applyEuler(this.camera.rotation).normalize();
  }

  getMuzzlePosition() {
    return this.camera.position.clone().add(this.getForward().multiplyScalar(0.55));
  }
}
