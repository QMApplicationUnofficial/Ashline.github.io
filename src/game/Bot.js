import * as THREE from 'three';
import { clamp, distanceXZ, easeOut, resolveAabbCollisionXZ } from './utils.js';

const BOT_NAMES = ['Vesper', 'Latch', 'Kairo', 'Nix', 'Sable', 'Dune'];

function makeMaterial(color, roughness = 0.75, metalness = 0.05) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

export class Bot {
  constructor(index, scene, map, particles, audio) {
    this.index = index;
    this.scene = scene;
    this.map = map;
    this.particles = particles;
    this.audio = audio;
    this.name = BOT_NAMES[index % BOT_NAMES.length];
    this.radius = 0.43;
    this.health = 100;
    this.alive = true;
    this.state = 'patrol';
    this.position = map.defenderSpawns[index % map.defenderSpawns.length].clone();
    this.destination = map.patrolPoints[index % map.patrolPoints.length].clone();
    this.lastSeen = null;
    this.shootCooldown = 0.5 + Math.random();
    this.thinkTimer = 0;
    this.coverTimer = 0;
    this.defuseTimer = 0;
    this.animTime = Math.random() * 10;
    this.lastMoveSpeed = 0;
    this.crouchAmount = 0;
    this.weaponKick = 0;
    this.deathProgress = 0;
    this.deathSide = Math.random() > 0.5 ? 1 : -1;
    this.aiming = false;
    this.lookTarget = this.destination.clone();
    this.raycaster = new THREE.Raycaster();
    this.group = this.createMesh();
    this.scene.add(this.group);
    this.setPosition(this.position);
  }

  createMesh() {
    const group = new THREE.Group();
    const rig = new THREE.Group();
    group.add(rig);
    this.rig = rig;
    this.parts = {};
    this.allMeshes = [];
    this.hitMeshes = [];

    const tint = new THREE.Color('#55b6c8').offsetHSL(this.index * 0.015, 0, (this.index % 2) * 0.05);
    const mats = {
      cloth: makeMaterial(tint, 0.78, 0.04),
      armor: makeMaterial('#1e2a2b', 0.72, 0.12),
      armorEdge: makeMaterial('#74837c', 0.62, 0.22),
      helmet: makeMaterial('#151918', 0.7, 0.18),
      visor: new THREE.MeshStandardMaterial({
        color: '#f0b85c',
        emissive: '#4d2a08',
        emissiveIntensity: 0.42,
        roughness: 0.42,
        metalness: 0.1
      }),
      boot: makeMaterial('#111413', 0.82, 0.08),
      weapon: makeMaterial('#191d1b', 0.62, 0.4)
    };

    const box = (parent, name, size, position, mat, rotation = [0, 0, 0], hit = true) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), mat);
      mesh.name = `bot-${this.index}-${name}`;
      mesh.position.set(position[0], position[1], position[2]);
      mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.bot = this;
      parent.add(mesh);
      this.allMeshes.push(mesh);
      if (hit) this.hitMeshes.push(mesh);
      return mesh;
    };

    const sphere = (parent, name, radius, position, mat, scale = [1, 1, 1], hit = true) => {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 16, 10), mat);
      mesh.name = `bot-${this.index}-${name}`;
      mesh.position.set(position[0], position[1], position[2]);
      mesh.scale.set(scale[0], scale[1], scale[2]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.bot = this;
      parent.add(mesh);
      this.allMeshes.push(mesh);
      if (hit) this.hitMeshes.push(mesh);
      return mesh;
    };

    const cylinder = (parent, name, radius, depth, position, mat, rotation = [Math.PI / 2, 0, 0], hit = false) => {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, depth, 14), mat);
      mesh.name = `bot-${this.index}-${name}`;
      mesh.position.set(position[0], position[1], position[2]);
      mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.bot = this;
      parent.add(mesh);
      this.allMeshes.push(mesh);
      if (hit) this.hitMeshes.push(mesh);
      return mesh;
    };

    this.parts.pelvis = box(rig, 'pelvis', [0.58, 0.24, 0.34], [0, 0.78, 0], mats.armor);
    this.parts.torso = box(rig, 'torso', [0.72, 0.78, 0.38], [0, 1.17, 0], mats.cloth);
    this.parts.vest = box(rig, 'vest', [0.78, 0.44, 0.43], [0, 1.22, -0.02], mats.armor);
    this.parts.chestPlate = box(rig, 'chest-plate', [0.48, 0.18, 0.46], [0, 1.39, -0.04], mats.armorEdge);
    this.parts.neck = box(rig, 'neck', [0.22, 0.14, 0.2], [0, 1.58, 0], mats.armor);
    this.parts.head = sphere(rig, 'head', 0.28, [0, 1.8, -0.02], mats.helmet, [0.95, 1.08, 0.95]);
    this.parts.helmet = sphere(rig, 'helmet', 0.31, [0, 1.86, -0.02], mats.helmet, [1.06, 0.74, 1.02], false);
    this.parts.visor = box(rig, 'visor', [0.44, 0.1, 0.07], [0, 1.83, -0.27], mats.visor);
    this.parts.pack = box(rig, 'pack', [0.46, 0.66, 0.16], [0, 1.15, 0.33], mats.armor, [0.08, 0, 0], false);
    this.parts.leftShoulder = box(rig, 'left-shoulder', [0.26, 0.16, 0.34], [-0.48, 1.45, -0.02], mats.armor);
    this.parts.rightShoulder = box(rig, 'right-shoulder', [0.26, 0.16, 0.34], [0.48, 1.45, -0.02], mats.armor);

    this.parts.leftArm = this.createLimb(rig, 'left-arm', -0.49, 1.36, mats, box);
    this.parts.rightArm = this.createLimb(rig, 'right-arm', 0.49, 1.36, mats, box);
    this.parts.leftLeg = this.createLeg(rig, 'left-leg', -0.2, mats, box);
    this.parts.rightLeg = this.createLeg(rig, 'right-leg', 0.2, mats, box);

    const weaponGroup = new THREE.Group();
    weaponGroup.position.set(0.33, 1.15, -0.38);
    weaponGroup.rotation.set(-0.16, -0.05, 0.02);
    rig.add(weaponGroup);
    this.parts.weaponGroup = weaponGroup;
    box(weaponGroup, 'weapon-body', [0.14, 0.13, 0.72], [0, 0, -0.18], mats.weapon, [0, 0, 0], false);
    box(weaponGroup, 'weapon-mag', [0.12, 0.28, 0.12], [-0.02, -0.18, -0.1], mats.weapon, [-0.18, 0, 0], false);
    cylinder(weaponGroup, 'weapon-barrel', 0.035, 0.68, [0, 0.02, -0.74], mats.weapon, [Math.PI / 2, 0, 0], false);

    for (const object of [group, rig, ...this.allMeshes, weaponGroup]) {
      object.userData.basePosition = object.position.clone();
      object.userData.baseRotation = object.rotation.clone();
      object.userData.baseScale = object.scale.clone();
    }

    return group;
  }

  createLimb(parent, name, x, y, mats, box) {
    const group = new THREE.Group();
    group.position.set(x, y, -0.02);
    parent.add(group);
    box(group, `${name}-upper`, [0.16, 0.38, 0.17], [0, -0.18, -0.03], mats.cloth);
    box(group, `${name}-forearm`, [0.15, 0.38, 0.16], [0, -0.45, -0.18], mats.armor);
    box(group, `${name}-hand`, [0.17, 0.12, 0.16], [0, -0.64, -0.31], mats.boot);
    return group;
  }

  createLeg(parent, name, x, mats, box) {
    const group = new THREE.Group();
    group.position.set(x, 0.72, 0.02);
    parent.add(group);
    box(group, `${name}-thigh`, [0.19, 0.44, 0.2], [0, -0.22, 0], mats.cloth);
    box(group, `${name}-knee`, [0.21, 0.12, 0.22], [0, -0.47, -0.03], mats.armor);
    box(group, `${name}-shin`, [0.17, 0.42, 0.18], [0, -0.7, 0.02], mats.armor);
    box(group, `${name}-boot`, [0.2, 0.13, 0.34], [0, -0.95, -0.08], mats.boot);
    return group;
  }

  reset(spawn) {
    this.health = 100;
    this.alive = true;
    this.state = 'patrol';
    this.position.copy(spawn);
    this.destination.copy(this.map.patrolPoints[this.index % this.map.patrolPoints.length]);
    this.lastSeen = null;
    this.shootCooldown = 0.5 + Math.random() * 0.7;
    this.thinkTimer = 0;
    this.coverTimer = 0;
    this.defuseTimer = 0;
    this.lastMoveSpeed = 0;
    this.crouchAmount = 0;
    this.weaponKick = 0;
    this.deathProgress = 0;
    this.deathSide = Math.random() > 0.5 ? 1 : -1;
    this.group.visible = true;
    this.resetPose();
    this.setPosition(this.position);
  }

  resetPose() {
    this.group.rotation.set(0, 0, 0);
    this.group.scale.set(1, 1, 1);
    this.rig.position.copy(this.rig.userData.basePosition);
    this.rig.rotation.copy(this.rig.userData.baseRotation);
    for (const key of Object.keys(this.parts)) {
      const part = this.parts[key];
      if (!part?.userData?.basePosition) continue;
      part.position.copy(part.userData.basePosition);
      part.rotation.copy(part.userData.baseRotation);
      part.scale.copy(part.userData.baseScale);
    }
  }

  setPosition(position) {
    this.group.position.copy(position);
  }

  update(dt, player, round) {
    this.animTime += dt;
    this.lastMoveSpeed = Math.max(0, this.lastMoveSpeed - dt * 8);

    if (!this.alive) {
      this.animateDeath(dt);
      return;
    }

    if (round.roundState === 'ended') {
      this.aiming = false;
      this.animate(dt, player);
      return;
    }

    this.thinkTimer -= dt;
    this.shootCooldown -= dt;
    this.coverTimer -= dt;

    const canSeePlayer = player.alive && this.canSee(player.camera.position);
    this.aiming = canSeePlayer;
    if (canSeePlayer) {
      this.state = 'chase';
      this.lastSeen = player.position.clone();
      this.lookTarget.copy(player.position);
    } else {
      this.lookTarget.copy(this.destination);
    }

    if (round.bombPlanted && round.bombSite) {
      this.state = canSeePlayer ? 'chase' : 'defuse';
      this.destination.copy(round.bombSite.position);
    } else if (this.state === 'cover' && this.coverTimer <= 0) {
      this.state = 'patrol';
    }

    if (this.thinkTimer <= 0) {
      this.thinkTimer = 0.28 + Math.random() * 0.25;
      this.chooseDestination(player, canSeePlayer, round);
    }

    if (canSeePlayer && this.shootCooldown <= 0) {
      this.shootAt(player);
    }

    if (this.state === 'defuse' && distanceXZ(this.position, round.bombSite.position) < 3.2) {
      round.botDefuse(dt, this);
    } else {
      this.defuseTimer = 0;
    }

    if (this.state !== 'guard' || distanceXZ(this.position, this.destination) > 2.4) {
      this.move(dt);
    }

    this.animate(dt, player);
  }

  chooseDestination(player, canSeePlayer, round) {
    if (this.state === 'defuse' && round.bombSite) {
      this.destination.copy(round.bombSite.position);
      return;
    }

    if (this.state === 'cover') {
      const cover = this.nearestCoverAwayFrom(player.position);
      this.destination.copy(cover);
      return;
    }

    if (canSeePlayer) {
      const distance = distanceXZ(this.position, player.position);
      if (distance > 11) {
        this.destination.copy(player.position);
      } else {
        this.state = 'guard';
        this.destination.copy(this.position);
      }
      return;
    }

    if (this.lastSeen && distanceXZ(this.position, this.lastSeen) > 2.2) {
      this.state = 'investigate';
      this.destination.copy(this.lastSeen);
      return;
    }

    if (distanceXZ(this.position, this.destination) < 2.1 || this.state !== 'patrol') {
      this.state = 'patrol';
      this.destination.copy(this.map.patrolPoints[Math.floor(Math.random() * this.map.patrolPoints.length)]);
    }
  }

  nearestCoverAwayFrom(threat) {
    let best = this.map.coverPoints[0];
    let bestScore = -Infinity;
    for (const point of this.map.coverPoints) {
      const fromBot = distanceXZ(this.position, point);
      const fromThreat = distanceXZ(threat, point);
      const score = fromThreat * 1.4 - fromBot;
      if (score > bestScore) {
        bestScore = score;
        best = point;
      }
    }
    return best;
  }

  move(dt) {
    const to = this.destination.clone().sub(this.position);
    to.y = 0;
    const distance = to.length();
    if (distance < 0.12) return;
    to.normalize();
    const speed = this.state === 'chase' ? 3.15 : this.state === 'defuse' ? 3.45 : 2.3;
    const previous = this.position.clone();
    this.position.addScaledVector(to, speed * dt);
    const resolved = resolveAabbCollisionXZ(this.position, previous, this.radius, this.map.colliders);
    const blocked = Math.abs(resolved.x - this.position.x) + Math.abs(resolved.z - this.position.z) > 0.01;
    this.position.x = resolved.x;
    this.position.z = resolved.z;
    this.lastMoveSpeed = distanceXZ(this.position, previous) / Math.max(dt, 0.001);
    if (blocked && this.state !== 'defuse') {
      this.destination.copy(this.map.patrolPoints[Math.floor(Math.random() * this.map.patrolPoints.length)]);
    }
    this.setPosition(this.position);
  }

  animate(dt) {
    const angle = Math.atan2(this.lookTarget.x - this.position.x, this.lookTarget.z - this.position.z);
    const turn = THREE.MathUtils.euclideanModulo(angle - this.group.rotation.y + Math.PI, Math.PI * 2) - Math.PI;
    this.group.rotation.y += turn * Math.min(1, dt * 7);

    const targetCrouch = this.state === 'cover' || this.state === 'defuse' ? 1 : 0;
    this.crouchAmount += (targetCrouch - this.crouchAmount) * Math.min(1, dt * 7);
    this.weaponKick = Math.max(0, this.weaponKick - dt * 9);
    const stride = clamp(this.lastMoveSpeed / 3.4, 0, 1) * (1 - this.crouchAmount * 0.35);
    const swing = Math.sin(this.animTime * (this.state === 'chase' ? 10 : 7.4)) * 0.58 * stride;
    const bob = Math.abs(Math.cos(this.animTime * 7.4)) * 0.045 * stride;

    this.rig.position.set(0, -this.crouchAmount * 0.34 + bob, 0);
    this.parts.torso.rotation.x = -0.08 * this.crouchAmount;
    this.parts.vest.rotation.x = -0.08 * this.crouchAmount;
    this.parts.head.rotation.x = -0.04 * this.crouchAmount;
    this.parts.helmet.rotation.x = -0.04 * this.crouchAmount;
    this.parts.visor.rotation.x = -0.04 * this.crouchAmount;

    this.parts.leftLeg.rotation.x = swing - this.crouchAmount * 0.45;
    this.parts.rightLeg.rotation.x = -swing - this.crouchAmount * 0.45;
    this.parts.leftLeg.rotation.z = this.crouchAmount * 0.12;
    this.parts.rightLeg.rotation.z = -this.crouchAmount * 0.12;

    const aimPose = this.aiming ? 1 : 0.35;
    this.parts.leftArm.rotation.x = -0.85 * aimPose - swing * 0.16 - this.crouchAmount * 0.18;
    this.parts.rightArm.rotation.x = -0.92 * aimPose + swing * 0.14 - this.weaponKick * 0.18;
    this.parts.leftArm.rotation.z = 0.28 + this.crouchAmount * 0.18;
    this.parts.rightArm.rotation.z = -0.2 - this.weaponKick * 0.08;
    this.parts.weaponGroup.rotation.x = -0.16 - this.weaponKick * 0.12 - this.crouchAmount * 0.08;
    this.parts.weaponGroup.position.z = -0.38 + this.weaponKick * 0.08;
  }

  animateDeath(dt) {
    this.deathProgress = Math.min(1, this.deathProgress + dt * 1.45);
    const fall = easeOut(this.deathProgress);
    this.group.position.set(this.position.x, this.position.y + 0.05 - fall * 0.1, this.position.z);
    this.group.rotation.z = this.deathSide * fall * 1.32;
    this.group.rotation.x = -fall * 0.6;
    this.rig.position.y = -fall * 0.48;
    this.parts.leftArm.rotation.x = -1.25 + fall * 1.1;
    this.parts.rightArm.rotation.x = -1.1 + fall * 0.9;
    this.parts.leftLeg.rotation.x = -fall * 0.55;
    this.parts.rightLeg.rotation.x = fall * 0.42;
    this.parts.weaponGroup.rotation.x = -0.4 - fall * 0.8;
  }

  hasLineOfSight(origin, target, maxDistance = 60) {
    const direction = target.clone().sub(origin);
    const distance = direction.length();
    if (distance > maxDistance) return false;
    direction.normalize();
    this.raycaster.set(origin, direction);
    this.raycaster.far = Math.max(0.05, distance - 0.25);
    const blocked = this.raycaster.intersectObjects(this.map.worldMeshes, false);
    return blocked.length === 0;
  }

  canSee(target) {
    // Bot needs a clear line from its eye to the player's head OR torso.
    const eye = this.position.clone().add(new THREE.Vector3(0, 1.45 - this.crouchAmount * 0.28, 0));
    const head = target.clone();
    const torso = target.clone().add(new THREE.Vector3(0, -0.5, 0));
    if (this.hasLineOfSight(eye, head, 38)) return true;
    if (this.hasLineOfSight(eye, torso, 38)) return true;
    return false;
  }

  shootAt(player) {
    this.shootCooldown = 0.34 + Math.random() * 0.42;
    this.weaponKick = 1;
    const origin = this.position.clone().add(new THREE.Vector3(0.22, 1.18 - this.crouchAmount * 0.28, 0));

    // Aim at the player's chest, not their head — easier to verify LOS through cover.
    const aimPoint = player.camera.position.clone().add(new THREE.Vector3(0, -0.45, 0));

    // The bot can only land a shot if there is a clear line from its actual muzzle to the aim point.
    const muzzleClear = this.hasLineOfSight(origin, aimPoint, 60);
    if (!muzzleClear) {
      // Fire a visible tracer that stops at the obstruction so the bot looks like it's still shooting,
      // but never deal damage through walls.
      const dir = aimPoint.clone().sub(origin).normalize();
      this.raycaster.set(origin, dir);
      this.raycaster.far = 60;
      const hit = this.raycaster.intersectObjects(this.map.worldMeshes, false)[0];
      const stopAt = hit ? hit.point : origin.clone().addScaledVector(dir, 60);
      this.particles.spawnTracer(origin, stopAt);
      this.audio.shoot('smg');
      return;
    }

    const direction = aimPoint.clone().sub(origin).normalize();
    const miss = player.position.distanceTo(this.position) * 0.0035 + Math.random() * 0.025;
    direction.x += (Math.random() - 0.5) * miss;
    direction.y += (Math.random() - 0.5) * miss;
    direction.z += (Math.random() - 0.5) * miss;
    direction.normalize();

    const endpoint = origin.clone().addScaledVector(direction, 60);
    this.particles.spawnTracer(origin, endpoint);
    this.audio.shoot('smg');

    const aimError = aimPoint.distanceTo(endpoint);
    if (aimError < 6.0) {
      player.damage(8 + Math.random() * 7, this.position);
    }
  }

  damage(amount, sourcePosition) {
    if (!this.alive) return false;
    this.health -= amount;
    this.state = 'cover';
    this.coverTimer = 1.6 + Math.random() * 1.2;
    this.lastSeen = sourcePosition.clone();
    if (this.health <= 0) {
      this.health = 0;
      this.alive = false;
      this.state = 'dead';
      this.deathProgress = 0;
      this.deathSide = Math.random() > 0.5 ? 1 : -1;
      this.particles.spawnImpactDust(this.position.clone().add(new THREE.Vector3(0, 1, 0)), new THREE.Vector3(0, 1, 0), 20);
      return true;
    }
    return false;
  }
}
