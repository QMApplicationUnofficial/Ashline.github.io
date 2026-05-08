import * as THREE from 'three';
import { clamp, resolveAabbCollisionXZ, rotateVector2 } from './utils.js';

const BASE_FOV = 74;
const ADS_FOV = 55;

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
    this.slideHeight = 0.95;
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
    this.aiming = false;
    this.aimBlend = 0;
    this.sliding = false;
    this.slideTime = 0;
    this.slideCooldown = 0;
    this.slideDir = new THREE.Vector3();
    this.slideSpeed = 9.6;
    this.smoothSpeed = 0;
    this.bobTime = 0;
    this.cameraBob = new THREE.Vector3();
    this.cameraTilt = 0;
    this.lastDamageFrom = new THREE.Vector3();
    this.camera.fov = BASE_FOV;
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
    this.sliding = false;
    this.slideTime = 0;
    this.aiming = false;
    this.aimBlend = 0;
  }

  update(dt) {
    if (!this.alive) return;
    this.updateLook(dt);
    this.updateMovement(dt);
    this.updateCamera(dt);
    this.damageFlash = Math.max(0, this.damageFlash - dt * 1.8);
    this.slideCooldown = Math.max(0, this.slideCooldown - dt);
  }

  updateLook(dt) {
    const mouse = this.input.consumeMouseDelta();
    const aimMul = 1 - this.aimBlend * 0.55;
    const sensitivity = 0.0019 * this.settings.values.mouseSensitivity * aimMul;
    this.yaw -= mouse.x * sensitivity;
    this.pitch -= mouse.y * sensitivity;
    this.pitch += this.recoil * dt * 12;
    this.recoil = Math.max(0, this.recoil - dt * 9);
    this.pitch = clamp(this.pitch, -1.45, 1.45);
  }

  updateMovement(dt) {
    const forward = Number(this.input.isDown('KeyW')) - Number(this.input.isDown('KeyS'));
    const strafe = Number(this.input.isDown('KeyD')) - Number(this.input.isDown('KeyA'));
    const crouchHeld = this.input.isDown('ControlLeft') || this.input.isDown('ControlRight') || this.input.isDown('KeyC');
    const sprintHeld = this.input.isDown('ShiftLeft');

    // Right mouse button = aim. Cannot aim while sprinting or sliding.
    const wantAim = this.input.mouseDown(2) && !this.sliding && !sprintHeld;
    this.aiming = wantAim;
    const aimTarget = wantAim ? 1 : 0;
    this.aimBlend += (aimTarget - this.aimBlend) * Math.min(1, dt * 10);

    // Slide trigger: while sprinting forward, press Ctrl/C.
    const wantSlide = (this.input.consume('ControlLeft') || this.input.consume('ControlRight') || this.input.consume('KeyC'));
    if (wantSlide && sprintHeld && forward > 0 && !this.sliding && this.slideCooldown <= 0 && this.grounded) {
      this.sliding = true;
      this.slideTime = 0.85;
      this.slideDir.copy(rotateVector2(0, -1, this.yaw)).normalize();
    }

    if (this.sliding) {
      this.slideTime -= dt;
      if (this.slideTime <= 0 || !this.grounded) {
        this.sliding = false;
        this.slideCooldown = 0.6;
      }
    }

    const sprinting = sprintHeld && forward > 0 && !crouchHeld && !this.aiming && !this.sliding;
    this.sprinting = sprinting;

    const baseTarget = this.sliding ? this.slideHeight : (crouchHeld ? this.crouchHeight : this.standHeight);
    this.height += (baseTarget - this.height) * Math.min(1, dt * 14);

    const baseSpeed = this.aiming ? 3.0 : crouchHeld ? 3.0 : sprinting ? 7.0 : 4.65;
    let move = new THREE.Vector3();

    if (this.sliding) {
      // Slide decelerates over its duration
      const slideT = clamp(this.slideTime / 0.85, 0, 1);
      const slideMag = this.slideSpeed * (0.45 + 0.55 * slideT);
      move.copy(this.slideDir).multiplyScalar(slideMag);
    } else if (forward || strafe) {
      move = rotateVector2(strafe, -forward, this.yaw).normalize().multiplyScalar(baseSpeed);
    }

    this.velocity.x = move.x;
    this.velocity.z = move.z;
    this.velocity.y -= 18 * dt;
    if (this.grounded && !this.sliding && this.input.consume('Space')) {
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
    if (moving && !this.sliding) {
      this.footstepTimer -= dt;
      if (this.footstepTimer <= 0) {
        this.footstepTimer = sprinting ? 0.25 : crouchHeld ? 0.55 : 0.38;
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

    // Smoothed planar speed for bob amplitude
    const planarSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    this.smoothSpeed += (planarSpeed - this.smoothSpeed) * Math.min(1, dt * 8);

    // Camera bob: vertical bounce + lateral sway tied to footsteps
    const bobAmp = clamp(this.smoothSpeed / 6.5, 0, 1.4);
    const freq = this.sprinting ? 11.5 : 8.4;
    this.bobTime += dt * freq * Math.max(0.001, Math.min(1.4, this.smoothSpeed / 4.5));
    const aimDamp = 1 - this.aimBlend * 0.85;
    const bobY = Math.abs(Math.cos(this.bobTime)) * 0.045 * bobAmp * aimDamp;
    const bobX = Math.sin(this.bobTime) * 0.03 * bobAmp * aimDamp;
    this.cameraBob.set(bobX, bobY, 0);

    // Camera tilt: lean into strafe, lean during slide
    const strafeAxis = Number(this.input.isDown('KeyA')) - Number(this.input.isDown('KeyD'));
    const targetTilt = this.sliding ? -0.32 : strafeAxis * 0.035 * aimDamp;
    this.cameraTilt += (targetTilt - this.cameraTilt) * Math.min(1, dt * 8);

    this.camera.position.set(
      this.position.x + shakeX + this.cameraBob.x,
      this.position.y + this.height + shakeY + this.cameraBob.y,
      this.position.z
    );
    this.camera.rotation.set(this.pitch, this.yaw, this.cameraTilt);

    // FOV transition for ADS / sprint
    const targetFov = BASE_FOV - this.aimBlend * (BASE_FOV - ADS_FOV) + (this.sprinting ? 4 : 0);
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 10);
      this.camera.updateProjectionMatrix();
    }
  }

  addRecoil(amount, shake = 0.45) {
    this.recoil += amount * (this.aiming ? 0.55 : 1);
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
