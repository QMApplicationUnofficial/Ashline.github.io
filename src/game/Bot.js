import * as THREE from 'three';
import { distanceXZ, resolveAabbCollisionXZ } from './utils.js';

const BOT_NAMES = ['Vesper', 'Latch', 'Kairo', 'Nix', 'Sable', 'Dune'];

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
    this.raycaster = new THREE.Raycaster();
    this.group = this.createMesh();
    this.scene.add(this.group);
    this.setPosition(this.position);
  }

  createMesh() {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({
      color: '#5db7ca',
      roughness: 0.72,
      metalness: 0.05
    });
    const darkMat = new THREE.MeshStandardMaterial({
      color: '#262b2a',
      roughness: 0.78
    });
    const visorMat = new THREE.MeshStandardMaterial({
      color: '#f0b85c',
      emissive: '#3c2108',
      emissiveIntensity: 0.4,
      roughness: 0.5
    });

    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 1.12, 12), bodyMat);
    body.position.y = 0.84;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.31, 16, 10), darkMat);
    head.position.y = 1.56;
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.11, 0.08), visorMat);
    visor.position.set(0, 1.58, -0.27);
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.62, 0.16), darkMat);
    pack.position.set(0, 0.95, 0.43);
    const weapon = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.78), darkMat);
    weapon.position.set(0.37, 1.05, -0.42);

    for (const mesh of [body, head, visor, pack, weapon]) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.bot = this;
      group.add(mesh);
    }
    this.hitMeshes = [body, head, visor];
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
    this.coverTimer = 0;
    this.defuseTimer = 0;
    this.group.visible = true;
    this.setPosition(this.position);
  }

  setPosition(position) {
    this.group.position.copy(position);
  }

  update(dt, player, round) {
    if (!this.alive) return;
    this.thinkTimer -= dt;
    this.shootCooldown -= dt;
    this.coverTimer -= dt;

    const canSeePlayer = player.alive && this.canSee(player.camera.position);
    if (canSeePlayer) {
      this.state = 'chase';
      this.lastSeen = player.position.clone();
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
    if (blocked && this.state !== 'defuse') {
      this.destination.copy(this.map.patrolPoints[Math.floor(Math.random() * this.map.patrolPoints.length)]);
    }
    this.setPosition(this.position);
  }

  animate(dt, player) {
    const lookTarget = player.alive && this.canSee(player.camera.position) ? player.position : this.destination;
    const angle = Math.atan2(lookTarget.x - this.position.x, lookTarget.z - this.position.z);
    const turn = THREE.MathUtils.euclideanModulo(angle - this.group.rotation.y + Math.PI, Math.PI * 2) - Math.PI;
    this.group.rotation.y += turn * Math.min(1, dt * 7);
    this.group.position.y = Math.sin(performance.now() * 0.006 + this.index) * 0.025;
  }

  canSee(target) {
    const origin = this.position.clone().add(new THREE.Vector3(0, 1.45, 0));
    const direction = target.clone().sub(origin);
    const distance = direction.length();
    if (distance > 38) return false;
    direction.normalize();
    this.raycaster.set(origin, direction);
    this.raycaster.far = distance - 0.8;
    const blocked = this.raycaster.intersectObjects(this.map.worldMeshes, false);
    return blocked.length === 0;
  }

  shootAt(player) {
    this.shootCooldown = 0.34 + Math.random() * 0.42;
    const origin = this.position.clone().add(new THREE.Vector3(0.22, 1.18, 0));
    const target = player.camera.position.clone();
    const direction = target.clone().sub(origin).normalize();
    const miss = player.position.distanceTo(this.position) * 0.0035 + Math.random() * 0.025;
    direction.x += (Math.random() - 0.5) * miss;
    direction.y += (Math.random() - 0.5) * miss;
    direction.z += (Math.random() - 0.5) * miss;
    direction.normalize();

    const endpoint = origin.clone().addScaledVector(direction, 60);
    this.particles.spawnTracer(origin, endpoint);
    this.audio.shoot('smg');

    const aimError = target.distanceTo(endpoint);
    const closeEnough = aimError < 7.2 || Math.random() > 0.68;
    if (this.canSee(player.camera.position) && closeEnough) {
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
      this.group.visible = false;
      this.particles.spawnImpactDust(this.position.clone().add(new THREE.Vector3(0, 1, 0)), new THREE.Vector3(0, 1, 0), 20);
      return true;
    }
    return false;
  }
}
