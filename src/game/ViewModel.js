import * as THREE from 'three';
import { clamp } from './utils.js';

function makeMaterial(color, roughness = 0.72, metalness = 0.05) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function addBox(parent, size, position, material, rotation = [0, 0, 0]) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), material);
  mesh.position.set(position[0], position[1], position[2]);
  mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  parent.add(mesh);
  return mesh;
}

function addCylinder(parent, radius, depth, position, material, rotation = [Math.PI / 2, 0, 0], segments = 18) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, depth, segments), material);
  mesh.position.set(position[0], position[1], position[2]);
  mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  parent.add(mesh);
  return mesh;
}

function addSphere(parent, radius, position, material, scale = [1, 1, 1]) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 16, 10), material);
  mesh.position.set(position[0], position[1], position[2]);
  mesh.scale.set(scale[0], scale[1], scale[2]);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  parent.add(mesh);
  return mesh;
}

export class WeaponViewModel {
  constructor(camera) {
    this.camera = camera;
    this.root = new THREE.Group();
    this.root.name = 'first-person-viewmodel';
    this.root.position.set(0.38, -0.5, -0.86);
    this.root.scale.setScalar(0.58);
    this.camera.add(this.root);

    this.materials = {
      gun: makeMaterial('#343a35', 0.62, 0.35),
      gunDark: makeMaterial('#181d1a', 0.68, 0.45),
      wornMetal: makeMaterial('#6d716a', 0.52, 0.58),
      accent: makeMaterial('#b8893f', 0.7, 0.15),
      grip: makeMaterial('#1c201f', 0.88, 0.08),
      sleeve: makeMaterial('#626b55', 0.78, 0.02),
      glove: makeMaterial('#1d211f', 0.82, 0.03),
      skin: makeMaterial('#b98560', 0.7, 0.01),
      flash: new THREE.MeshBasicMaterial({
        color: '#ffd27a',
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    };

    this.models = new Map();
    this.activeModel = null;
    this.activeWeaponId = null;
    this.shootKick = 0;
    this.reloadTime = 0;
    this.reloadDuration = 1;
    this.switchTime = 0;
    this.flashTime = 0;
    this.bobTime = 0;
    this.restPosition = new THREE.Vector3(0.38, -0.5, -0.86);
    this.restRotation = new THREE.Euler(-0.02, 0.03, -0.025);

    this.createModel('ravelin');
    this.createModel('mote');
    this.createModel('talon');
    this.setWeapon('ravelin');
  }

  createModel(id) {
    const group = new THREE.Group();
    group.visible = false;
    this.root.add(group);
    const parts = {
      group,
      muzzle: new THREE.Object3D(),
      magazine: null,
      bolt: null,
      leftHand: null,
      rightHand: null,
      flash: null
    };

    if (id === 'ravelin') this.buildRavelin(parts);
    if (id === 'mote') this.buildMote(parts);
    if (id === 'talon') this.buildTalon(parts);

    group.add(parts.muzzle);
    group.traverse((object) => {
      object.userData.basePosition = object.position.clone();
      object.userData.baseRotation = object.rotation.clone();
    });
    this.models.set(id, parts);
    return parts;
  }

  buildRavelin(parts) {
    const g = parts.group;
    addBox(g, [0.72, 0.17, 0.72], [0, 0.02, -0.38], this.materials.gun);
    addBox(g, [0.56, 0.13, 0.48], [0.02, 0.12, -0.42], this.materials.gunDark);
    addBox(g, [0.28, 0.15, 0.46], [0.05, -0.19, -0.3], this.materials.grip, [-0.32, 0, 0]);
    parts.magazine = addBox(g, [0.25, 0.52, 0.2], [-0.05, -0.34, -0.5], this.materials.gunDark, [-0.14, 0, 0]);
    addBox(g, [0.22, 0.18, 0.55], [0.04, 0.04, 0.16], this.materials.gunDark);
    addBox(g, [0.34, 0.18, 0.38], [0.02, 0.04, -0.82], this.materials.wornMetal);
    addCylinder(g, 0.045, 1.02, [0.02, 0.07, -1.42], this.materials.wornMetal);
    addCylinder(g, 0.073, 0.22, [0.02, 0.07, -1.98], this.materials.gunDark);
    addBox(g, [0.42, 0.055, 0.82], [0.02, 0.22, -0.54], this.materials.accent);
    addBox(g, [0.25, 0.18, 0.32], [0.02, 0.34, -0.54], this.materials.gunDark);
    parts.bolt = addBox(g, [0.12, 0.05, 0.28], [0.42, 0.13, -0.52], this.materials.wornMetal);
    this.addHands(g, parts, {
      right: [0.38, -0.3, -0.2],
      left: [-0.3, -0.2, -0.88],
      leftAngle: -0.35
    });
    parts.muzzle.position.set(0.02, 0.07, -2.12);
    this.addMuzzleFlash(g, parts, [0.02, 0.07, -2.13], 0.36);
  }

  buildMote(parts) {
    const g = parts.group;
    addBox(g, [0.54, 0.18, 0.58], [0.02, 0.03, -0.38], this.materials.gunDark);
    addBox(g, [0.46, 0.13, 0.42], [0.02, 0.14, -0.44], this.materials.gun);
    addBox(g, [0.22, 0.14, 0.38], [0.07, -0.18, -0.24], this.materials.grip, [-0.42, 0, 0]);
    parts.magazine = addBox(g, [0.18, 0.56, 0.18], [-0.08, -0.36, -0.48], this.materials.gunDark, [0.12, 0, 0]);
    addBox(g, [0.32, 0.16, 0.34], [0.02, 0.03, -0.75], this.materials.wornMetal);
    addCylinder(g, 0.04, 0.68, [0.02, 0.06, -1.18], this.materials.wornMetal);
    addCylinder(g, 0.08, 0.34, [0.02, 0.06, -1.68], this.materials.gunDark);
    addBox(g, [0.25, 0.055, 0.45], [0.02, 0.24, -0.43], this.materials.accent);
    parts.bolt = addBox(g, [0.1, 0.05, 0.22], [0.34, 0.13, -0.42], this.materials.wornMetal);
    this.addHands(g, parts, {
      right: [0.36, -0.3, -0.18],
      left: [-0.26, -0.22, -0.72],
      leftAngle: -0.48
    });
    parts.muzzle.position.set(0.02, 0.06, -1.89);
    this.addMuzzleFlash(g, parts, [0.02, 0.06, -1.9], 0.3);
  }

  buildTalon(parts) {
    const g = parts.group;
    g.position.set(0.08, -0.03, 0.08);
    addBox(g, [0.38, 0.18, 0.62], [0.02, 0.04, -0.4], this.materials.gunDark);
    addBox(g, [0.42, 0.15, 0.46], [0.02, 0.18, -0.42], this.materials.wornMetal);
    addBox(g, [0.21, 0.43, 0.17], [0.05, -0.28, -0.25], this.materials.grip, [-0.34, 0, 0]);
    parts.magazine = addBox(g, [0.17, 0.35, 0.13], [0.05, -0.47, -0.2], this.materials.gunDark, [-0.32, 0, 0]);
    addCylinder(g, 0.035, 0.5, [0.02, 0.19, -0.86], this.materials.gunDark);
    parts.bolt = addBox(g, [0.3, 0.035, 0.32], [0.02, 0.28, -0.48], this.materials.accent);
    this.addHands(g, parts, {
      right: [0.33, -0.28, -0.1],
      left: [-0.18, -0.32, -0.34],
      leftAngle: -0.75,
      compact: true
    });
    parts.muzzle.position.set(0.02, 0.19, -1.14);
    this.addMuzzleFlash(g, parts, [0.02, 0.19, -1.16], 0.24);
  }

  addHands(parent, parts, config) {
    parts.rightHand = new THREE.Group();
    parts.leftHand = new THREE.Group();
    parts.rightHand.position.set(config.right[0], config.right[1], config.right[2]);
    parts.leftHand.position.set(config.left[0], config.left[1], config.left[2]);
    parts.rightHand.rotation.set(-0.58, 0.03, 0.14);
    parts.leftHand.rotation.set(config.leftAngle, -0.08, -0.18);

    this.addArm(parts.rightHand, config.compact ? 0.82 : 0.95);
    this.addArm(parts.leftHand, config.compact ? 0.68 : 0.88);
    parent.add(parts.rightHand, parts.leftHand);
  }

  addArm(group, length) {
    addCylinder(group, 0.09, length, [0, -0.12, 0.3], this.materials.sleeve, [1.18, 0, 0], 12);
    addCylinder(group, 0.08, 0.36, [0, 0.02, -0.17], this.materials.glove, [1.22, 0, 0], 12);
    addSphere(group, 0.105, [0, -0.02, -0.34], this.materials.glove, [1.15, 0.78, 0.75]);
    for (let i = 0; i < 4; i += 1) {
      addBox(group, [0.032, 0.04, 0.14], [-0.055 + i * 0.036, -0.02, -0.43], this.materials.glove, [0.22, 0, 0]);
    }
  }

  addMuzzleFlash(parent, parts, position, scale) {
    const flash = new THREE.Mesh(new THREE.ConeGeometry(scale * 0.42, scale, 7, 1, true), this.materials.flash.clone());
    flash.position.set(position[0], position[1], position[2]);
    flash.rotation.x = -Math.PI / 2;
    flash.visible = false;
    parent.add(flash);
    parts.flash = flash;
  }

  setWeapon(id) {
    if (this.activeWeaponId === id) return;
    this.activeWeaponId = id;
    for (const [weaponId, model] of this.models) {
      model.group.visible = weaponId === id;
    }
    this.activeModel = this.models.get(id);
    this.switchTime = 0.2;
  }

  playShoot() {
    this.shootKick = 1;
    this.flashTime = 0.045;
    if (this.activeModel?.flash) {
      this.activeModel.flash.visible = true;
      this.activeModel.flash.material.opacity = 0.92;
      this.activeModel.flash.rotation.z = Math.random() * Math.PI;
    }
  }

  playReload(duration) {
    this.reloadDuration = Math.max(0.2, duration);
    this.reloadTime = this.reloadDuration;
  }

  getMuzzleWorldPosition(target = new THREE.Vector3()) {
    if (!this.activeModel) return this.camera.getWorldPosition(target);
    this.activeModel.muzzle.getWorldPosition(target);
    return target;
  }

  update(dt, weapon, player) {
    if (weapon) this.setWeapon(weapon.id);
    this.bobTime += dt * Math.max(1, Math.hypot(player.velocity.x, player.velocity.z) * 1.5);
    this.shootKick = Math.max(0, this.shootKick - dt * 12);
    this.switchTime = Math.max(0, this.switchTime - dt * 5);
    this.reloadTime = Math.max(0, this.reloadTime - dt);
    this.flashTime = Math.max(0, this.flashTime - dt);

    const speed = Math.hypot(player.velocity.x, player.velocity.z);
    const bobAmount = clamp(speed / 7, 0, 1);
    const bobX = Math.sin(this.bobTime * 7.6) * 0.018 * bobAmount;
    const bobY = Math.abs(Math.cos(this.bobTime * 7.6)) * 0.02 * bobAmount;
    const recoil = this.shootKick;
    const reloadT = this.reloadDuration > 0 ? 1 - this.reloadTime / this.reloadDuration : 1;
    const reloadWave = this.reloadTime > 0 ? Math.sin(clamp(reloadT, 0, 1) * Math.PI) : 0;
    const switchDrop = this.switchTime * 0.2;

    this.root.position.set(
      this.restPosition.x + bobX,
      this.restPosition.y - reloadWave * 0.18 - switchDrop + bobY,
      this.restPosition.z + recoil * 0.12 + reloadWave * 0.08
    );
    this.root.rotation.set(
      this.restRotation.x - recoil * 0.12 - reloadWave * 0.2,
      this.restRotation.y + recoil * 0.06,
      this.restRotation.z + bobX * 0.7 + reloadWave * 0.5
    );

    if (this.activeModel) {
      const model = this.activeModel;
      if (model.magazine) {
        model.magazine.position.copy(model.magazine.userData.basePosition);
        model.magazine.rotation.copy(model.magazine.userData.baseRotation);
        const drop = this.reloadTime > 0 ? Math.sin(clamp(reloadT, 0, 1) * Math.PI) * 0.36 : 0;
        model.magazine.position.y -= drop;
        model.magazine.rotation.x += reloadWave * 0.55;
      }
      if (model.bolt) {
        model.bolt.position.copy(model.bolt.userData.basePosition);
        model.bolt.rotation.copy(model.bolt.userData.baseRotation);
        model.bolt.position.z += recoil * 0.12;
      }
      if (model.leftHand) {
        model.leftHand.position.copy(model.leftHand.userData.basePosition);
        model.leftHand.rotation.copy(model.leftHand.userData.baseRotation);
        model.leftHand.rotation.z += reloadWave * 0.55;
        model.leftHand.position.y += reloadWave * Math.sin(reloadT * Math.PI * 2) * 0.07;
      }
      if (model.rightHand) {
        model.rightHand.position.copy(model.rightHand.userData.basePosition);
        model.rightHand.rotation.copy(model.rightHand.userData.baseRotation);
        model.rightHand.rotation.x -= recoil * 0.12;
      }
      if (model.flash) {
        model.flash.visible = this.flashTime > 0;
        model.flash.material.opacity = this.flashTime > 0 ? this.flashTime / 0.045 : 0;
      }
    }
  }
}
