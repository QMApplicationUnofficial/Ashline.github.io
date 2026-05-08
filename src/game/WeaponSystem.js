import * as THREE from 'three';

export const WEAPONS = [
  {
    id: 'ravelin',
    name: 'Ravelin AR',
    kind: 'rifle',
    damage: 28,
    fireRate: 0.105,
    spread: 0.010,
    recoil: 0.018,
    magSize: 24,
    reserve: 96,
    reloadTime: 1.65,
    range: 90,
    price: 700,
    note: 'Balanced rifle for lanes and site entries.'
  },
  {
    id: 'mote',
    name: 'Mote-9',
    kind: 'smg',
    damage: 18,
    fireRate: 0.064,
    spread: 0.017,
    recoil: 0.012,
    magSize: 32,
    reserve: 128,
    reloadTime: 1.35,
    range: 62,
    price: 500,
    note: 'Fast close-range spray with lighter recoil.'
  },
  {
    id: 'talon',
    name: 'Talon Pistol',
    kind: 'pistol',
    damage: 34,
    fireRate: 0.24,
    spread: 0.008,
    recoil: 0.026,
    magSize: 12,
    reserve: 48,
    reloadTime: 1.1,
    range: 76,
    price: 200,
    note: 'Precise sidearm with punchy single shots.'
  }
];

export class WeaponSystem {
  constructor({ player, input, camera, scene, map, particles, decals, audio, onHit, onKill }) {
    this.player = player;
    this.input = input;
    this.camera = camera;
    this.scene = scene;
    this.map = map;
    this.particles = particles;
    this.decals = decals;
    this.audio = audio;
    this.onHit = onHit;
    this.onKill = onKill;
    this.raycaster = new THREE.Raycaster();
    this.weapons = WEAPONS.map((config) => ({
      ...config,
      ammo: config.magSize,
      reserveAmmo: config.reserve,
      cooldown: 0,
      reload: 0
    }));
    this.activeIndex = 0;
    this.flashLight = new THREE.PointLight(0xffcc72, 0, 7);
    this.scene.add(this.flashLight);
    this.flashTime = 0;
  }

  get active() {
    return this.weapons[this.activeIndex];
  }

  resetAmmo() {
    for (const weapon of this.weapons) {
      weapon.ammo = weapon.magSize;
      weapon.reserveAmmo = weapon.reserve;
      weapon.cooldown = 0;
      weapon.reload = 0;
    }
  }

  select(index) {
    if (index < 0 || index >= this.weapons.length) return;
    this.activeIndex = index;
  }

  update(dt, bots, enabled = true) {
    for (const weapon of this.weapons) {
      weapon.cooldown = Math.max(0, weapon.cooldown - dt);
      if (weapon.reload > 0) {
        weapon.reload -= dt;
        if (weapon.reload <= 0) this.finishReload(weapon);
      }
    }

    if (this.input.consume('Digit1')) this.select(0);
    if (this.input.consume('Digit2')) this.select(1);
    if (this.input.consume('Digit3')) this.select(2);

    const wheel = this.input.consumeScroll();
    if (wheel !== 0) {
      this.select((this.activeIndex + Math.sign(wheel) + this.weapons.length) % this.weapons.length);
    }

    if (enabled && this.input.consume('KeyR')) this.reload();
    if (enabled && this.input.mouseDown(0)) this.tryShoot(bots);

    if (this.flashTime > 0) {
      this.flashTime -= dt;
      this.flashLight.intensity = 22 * Math.max(0, this.flashTime / 0.04);
      this.flashLight.position.copy(this.player.getMuzzlePosition());
    } else {
      this.flashLight.intensity = 0;
    }
  }

  tryShoot(bots) {
    const weapon = this.active;
    if (!this.player.alive || weapon.reload > 0 || weapon.cooldown > 0) return;
    if (weapon.ammo <= 0) {
      this.reload();
      return;
    }

    weapon.ammo -= 1;
    weapon.cooldown = weapon.fireRate;
    this.flashTime = 0.04;
    this.player.addRecoil(weapon.recoil, weapon.kind === 'pistol' ? 0.62 : 0.45);
    this.audio.shoot(weapon.kind);

    const origin = this.camera.position.clone();
    const direction = this.camera.getWorldDirection(new THREE.Vector3());
    this.applySpread(direction, weapon.spread + (this.player.input.isDown('ShiftLeft') ? 0.006 : 0));

    const target = this.castShot(origin, direction, weapon.range, bots);
    const muzzle = this.player.getMuzzlePosition();
    this.particles.spawnTracer(muzzle, target.point);

    if (target.bot) {
      const killed = target.bot.damage(weapon.damage, origin);
      this.onHit?.(target.bot, killed);
      if (killed) this.onKill?.(target.bot, weapon);
    } else {
      this.audio.impact();
      this.decals.add(target.point, target.normal, target.surface === 'metal' ? 0.65 : 1);
      this.particles.spawnImpactDust(target.point, target.normal, target.surface === 'metal' ? 4 : 10);
    }
  }

  applySpread(direction, amount) {
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);
    direction
      .addScaledVector(right, (Math.random() - 0.5) * amount)
      .addScaledVector(up, (Math.random() - 0.5) * amount)
      .normalize();
  }

  castShot(origin, direction, range, bots) {
    this.raycaster.set(origin, direction);
    this.raycaster.far = range;
    const botMeshes = bots.flatMap((bot) => bot.hitMeshes);
    const hits = this.raycaster.intersectObjects([...this.map.worldMeshes, ...botMeshes], false);
    const hit = hits[0];
    if (!hit) {
      return {
        point: origin.clone().addScaledVector(direction, range),
        normal: direction.clone().multiplyScalar(-1),
        bot: null,
        surface: 'dust'
      };
    }

    const bot = hit.object.userData.bot;
    const normal = hit.face
      ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize()
      : direction.clone().multiplyScalar(-1);

    return {
      point: hit.point.clone(),
      normal,
      bot: bot?.alive ? bot : null,
      surface: hit.object.userData.surface ?? 'dust'
    };
  }

  reload() {
    const weapon = this.active;
    if (weapon.reload > 0 || weapon.ammo === weapon.magSize || weapon.reserveAmmo <= 0) return;
    weapon.reload = weapon.reloadTime;
    this.audio.reload();
  }

  finishReload(weapon) {
    const needed = weapon.magSize - weapon.ammo;
    const taken = Math.min(needed, weapon.reserveAmmo);
    weapon.ammo += taken;
    weapon.reserveAmmo -= taken;
    weapon.reload = 0;
  }
}
