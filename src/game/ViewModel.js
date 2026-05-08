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

function addTaperedCylinder(parent, rTop, rBottom, depth, position, material, rotation = [Math.PI / 2, 0, 0], segments = 18) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, depth, segments), material);
  mesh.position.set(position[0], position[1], position[2]);
  mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
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

function buildMagazine(material, scale = [1, 1, 1]) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.22 * scale[0], 0.5 * scale[1], 0.18 * scale[2]), material);
  body.position.y = 0;
  group.add(body);
  const baseplate = new THREE.Mesh(new THREE.BoxGeometry(0.24 * scale[0], 0.05 * scale[1], 0.2 * scale[2]), material);
  baseplate.position.y = -0.27 * scale[1];
  group.add(baseplate);
  return group;
}

export class WeaponViewModel {
  constructor(camera) {
    this.camera = camera;
    this.root = new THREE.Group();
    this.root.name = 'first-person-viewmodel';
    this.root.position.set(0.34, -0.46, -0.78);
    this.root.scale.setScalar(0.58);
    this.camera.add(this.root);

    this.materials = {
      gun: makeMaterial('#2a2f2c', 0.55, 0.42),
      gunDark: makeMaterial('#121613', 0.52, 0.55),
      polymer: makeMaterial('#1b1f1d', 0.92, 0.02),
      wornMetal: makeMaterial('#5b6058', 0.42, 0.7),
      steel: makeMaterial('#7d827a', 0.32, 0.85),
      accent: makeMaterial('#a07a35', 0.7, 0.2),
      grip: makeMaterial('#15191a', 0.95, 0.04),
      sleeve: makeMaterial('#525a47', 0.82, 0.02),
      glove: makeMaterial('#16191a', 0.88, 0.04),
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
    this.smoothSpeed = 0;
    this.sprintBlend = 0;
    this.holsterBlend = 0;
    this.restPosition = new THREE.Vector3(0.34, -0.46, -0.78);
    this.restRotation = new THREE.Euler(-0.02, 0.03, -0.02);

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
      magazineNew: null,
      magazineHome: new THREE.Vector3(),
      bolt: null,
      leftHand: null,
      rightHand: null,
      flash: null
    };

    if (id === 'ravelin') this.buildRavelin(parts);
    if (id === 'mote') this.buildMote(parts);
    if (id === 'talon') this.buildTalon(parts);

    group.add(parts.muzzle);
    if (parts.magazine) {
      parts.magazineHome.copy(parts.magazine.position);
    }
    group.traverse((object) => {
      object.userData.basePosition = object.position.clone();
      object.userData.baseRotation = object.rotation.clone();
    });
    this.models.set(id, parts);
    return parts;
  }

  buildRavelin(parts) {
    const g = parts.group;
    // Lower receiver
    addBox(g, [0.36, 0.2, 0.92], [0.02, -0.02, -0.42], this.materials.gunDark);
    // Upper receiver
    addBox(g, [0.34, 0.18, 0.96], [0.02, 0.13, -0.4], this.materials.gun);
    // Picatinny rail (top)
    addBox(g, [0.14, 0.04, 1.02], [0.02, 0.24, -0.42], this.materials.gunDark);
    for (let i = 0; i < 9; i += 1) {
      addBox(g, [0.16, 0.025, 0.04], [0.02, 0.28, -0.85 + i * 0.11], this.materials.gunDark);
    }
    // Rear sight block
    addBox(g, [0.12, 0.1, 0.08], [0.02, 0.32, -0.04], this.materials.steel);
    addBox(g, [0.04, 0.06, 0.02], [0.02, 0.39, -0.04], this.materials.steel);
    // Front sight post
    addBox(g, [0.08, 0.16, 0.06], [0.02, 0.32, -1.32], this.materials.steel);
    addCylinder(g, 0.012, 0.16, [0.02, 0.34, -1.32], this.materials.gunDark, [0, 0, 0], 8);
    // Pistol grip (angled)
    addBox(g, [0.16, 0.34, 0.18], [0.04, -0.28, -0.18], this.materials.grip, [-0.32, 0, 0]);
    addBox(g, [0.17, 0.06, 0.18], [0.04, -0.46, -0.12], this.materials.grip, [-0.32, 0, 0]);
    // Trigger guard
    addBox(g, [0.1, 0.04, 0.18], [0.04, -0.16, -0.12], this.materials.gunDark);
    addBox(g, [0.1, 0.12, 0.025], [0.04, -0.22, -0.04], this.materials.gunDark);
    addBox(g, [0.1, 0.12, 0.025], [0.04, -0.22, -0.2], this.materials.gunDark);
    // Trigger
    addBox(g, [0.04, 0.07, 0.03], [0.04, -0.18, -0.12], this.materials.steel);
    // Magazine well + magazine
    addBox(g, [0.24, 0.12, 0.22], [0.02, -0.16, -0.5], this.materials.gunDark);
    parts.magazine = buildMagazine(this.materials.polymer);
    parts.magazine.position.set(0.02, -0.46, -0.5);
    parts.magazine.rotation.set(-0.05, 0, 0);
    g.add(parts.magazine);
    // Hidden new magazine (for reload insertion)
    parts.magazineNew = buildMagazine(this.materials.polymer);
    parts.magazineNew.position.set(0.02, -1.4, -0.5);
    parts.magazineNew.rotation.set(-0.05, 0, 0);
    parts.magazineNew.visible = false;
    g.add(parts.magazineNew);
    // Stock
    addBox(g, [0.16, 0.14, 0.42], [0.02, 0.04, 0.18], this.materials.polymer);
    addBox(g, [0.14, 0.26, 0.06], [0.02, -0.04, 0.4], this.materials.polymer);
    addBox(g, [0.08, 0.06, 0.36], [0.02, 0.16, 0.16], this.materials.gunDark);
    // Handguard (rails fore-end)
    addBox(g, [0.22, 0.18, 0.66], [0.02, 0.06, -1.0], this.materials.gun);
    addBox(g, [0.16, 0.04, 0.7], [0.02, 0.18, -1.0], this.materials.gunDark);
    for (let i = 0; i < 5; i += 1) {
      addBox(g, [0.24, 0.02, 0.04], [0.02, 0.04, -0.74 - i * 0.12], this.materials.gunDark);
    }
    // Barrel + gas block + flash hider
    addCylinder(g, 0.04, 1.02, [0.02, 0.06, -1.5], this.materials.steel);
    addCylinder(g, 0.06, 0.1, [0.02, 0.06, -1.16], this.materials.gunDark);
    addCylinder(g, 0.08, 0.18, [0.02, 0.06, -2.05], this.materials.gunDark);
    // Flash hider slots
    for (let i = 0; i < 5; i += 1) {
      const ang = (i / 5) * Math.PI * 2;
      addBox(g, [0.012, 0.06, 0.12], [0.02 + Math.cos(ang) * 0.06, 0.06 + Math.sin(ang) * 0.06, -2.05], this.materials.gun, [0, 0, ang]);
    }
    // Charging handle
    parts.bolt = addBox(g, [0.1, 0.04, 0.22], [0.02, 0.27, 0.06], this.materials.steel);
    // Hands
    this.addHands(g, parts, {
      right: [0.1, -0.32, -0.08],
      rightAngle: [-0.5, 0.04, 0.16],
      left: [-0.04, -0.06, -1.1],
      leftAngle: [-0.6, -0.04, -0.1]
    });
    parts.muzzle.position.set(0.02, 0.06, -2.16);
    this.addMuzzleFlash(g, parts, [0.02, 0.06, -2.18], 0.36);
  }

  buildMote(parts) {
    const g = parts.group;
    // Receiver
    addBox(g, [0.3, 0.2, 0.7], [0.02, 0.02, -0.4], this.materials.gunDark);
    addBox(g, [0.28, 0.16, 0.74], [0.02, 0.16, -0.42], this.materials.gun);
    // Top rail
    addBox(g, [0.12, 0.03, 0.78], [0.02, 0.25, -0.42], this.materials.gunDark);
    // Folding stock
    addBox(g, [0.14, 0.12, 0.34], [0.02, 0.06, 0.1], this.materials.polymer);
    addBox(g, [0.12, 0.2, 0.06], [0.02, -0.02, 0.28], this.materials.polymer);
    // Pistol grip
    addBox(g, [0.14, 0.3, 0.16], [0.06, -0.24, -0.2], this.materials.grip, [-0.42, 0, 0]);
    // Trigger guard
    addBox(g, [0.1, 0.04, 0.18], [0.04, -0.16, -0.16], this.materials.gunDark);
    addBox(g, [0.08, 0.06, 0.025], [0.04, -0.2, -0.08], this.materials.gunDark);
    // Magwell + mag
    addBox(g, [0.2, 0.1, 0.2], [0.0, -0.14, -0.5], this.materials.gunDark);
    parts.magazine = buildMagazine(this.materials.polymer, [0.85, 1.05, 0.95]);
    parts.magazine.position.set(0.0, -0.42, -0.5);
    parts.magazine.rotation.set(0.08, 0, 0);
    g.add(parts.magazine);
    parts.magazineNew = buildMagazine(this.materials.polymer, [0.85, 1.05, 0.95]);
    parts.magazineNew.position.set(0.0, -1.3, -0.5);
    parts.magazineNew.rotation.set(0.08, 0, 0);
    parts.magazineNew.visible = false;
    g.add(parts.magazineNew);
    // Handguard
    addBox(g, [0.18, 0.16, 0.4], [0.02, 0.04, -0.92], this.materials.gun);
    // Barrel + flash
    addCylinder(g, 0.035, 0.62, [0.02, 0.06, -1.18], this.materials.steel);
    addCylinder(g, 0.07, 0.18, [0.02, 0.06, -1.55], this.materials.gunDark);
    // Charging handle
    parts.bolt = addBox(g, [0.08, 0.04, 0.18], [0.18, 0.16, -0.4], this.materials.steel);
    this.addHands(g, parts, {
      right: [0.12, -0.32, -0.16],
      rightAngle: [-0.55, 0.04, 0.18],
      left: [-0.06, -0.05, -0.94],
      leftAngle: [-0.6, -0.06, -0.14]
    });
    parts.muzzle.position.set(0.02, 0.06, -1.66);
    this.addMuzzleFlash(g, parts, [0.02, 0.06, -1.68], 0.3);
  }

  buildTalon(parts) {
    const g = parts.group;
    g.position.set(0.04, -0.02, 0.06);
    // Slide
    addBox(g, [0.16, 0.18, 0.7], [0.02, 0.16, -0.36], this.materials.gunDark);
    addBox(g, [0.14, 0.14, 0.74], [0.02, 0.16, -0.38], this.materials.gun);
    // Frame
    addBox(g, [0.14, 0.1, 0.5], [0.02, 0.0, -0.3], this.materials.polymer);
    // Grip
    addBox(g, [0.16, 0.42, 0.18], [0.04, -0.28, -0.22], this.materials.grip, [-0.34, 0, 0]);
    // Trigger guard
    addBox(g, [0.09, 0.04, 0.16], [0.04, -0.1, -0.18], this.materials.gunDark);
    addBox(g, [0.07, 0.06, 0.025], [0.04, -0.13, -0.1], this.materials.gunDark);
    // Mag
    parts.magazine = buildMagazine(this.materials.polymer, [0.6, 0.7, 0.6]);
    parts.magazine.position.set(0.05, -0.46, -0.2);
    parts.magazine.rotation.set(-0.32, 0, 0);
    g.add(parts.magazine);
    parts.magazineNew = buildMagazine(this.materials.polymer, [0.6, 0.7, 0.6]);
    parts.magazineNew.position.set(0.05, -1.2, -0.2);
    parts.magazineNew.rotation.set(-0.32, 0, 0);
    parts.magazineNew.visible = false;
    g.add(parts.magazineNew);
    // Barrel
    addCylinder(g, 0.028, 0.5, [0.02, 0.16, -0.84], this.materials.steel);
    // Sights
    addBox(g, [0.04, 0.04, 0.04], [0.02, 0.28, -0.04], this.materials.steel);
    addBox(g, [0.04, 0.04, 0.04], [0.02, 0.28, -0.66], this.materials.steel);
    // Slide serrations + bolt
    parts.bolt = addBox(g, [0.16, 0.04, 0.04], [0.02, 0.28, -0.08], this.materials.gunDark);
    this.addHands(g, parts, {
      right: [0.05, -0.28, -0.16],
      rightAngle: [-0.55, 0.06, 0.16],
      left: [-0.16, -0.18, -0.32],
      leftAngle: [-0.7, -0.2, -0.18],
      compact: true
    });
    parts.muzzle.position.set(0.02, 0.16, -1.12);
    this.addMuzzleFlash(g, parts, [0.02, 0.16, -1.14], 0.24);
  }

  addHands(parent, parts, config) {
    parts.rightHand = new THREE.Group();
    parts.leftHand = new THREE.Group();
    parts.rightHand.position.set(config.right[0], config.right[1], config.right[2]);
    parts.leftHand.position.set(config.left[0], config.left[1], config.left[2]);
    parts.rightHand.rotation.set(config.rightAngle[0], config.rightAngle[1], config.rightAngle[2]);
    parts.leftHand.rotation.set(config.leftAngle[0], config.leftAngle[1], config.leftAngle[2]);

    this.addArm(parts.rightHand, config.compact ? 0.78 : 0.92, true);
    this.addArm(parts.leftHand, config.compact ? 0.62 : 0.82, false);
    parent.add(parts.rightHand, parts.leftHand);
  }

  addArm(group, length, isRight) {
    addCylinder(group, 0.085, length, [0, -0.1, 0.32], this.materials.sleeve, [1.18, 0, 0], 12);
    addCylinder(group, 0.075, 0.34, [0, 0.0, -0.16], this.materials.glove, [1.22, 0, 0], 12);
    // Palm
    addBox(group, [0.16, 0.07, 0.18], [0, -0.02, -0.3], this.materials.glove);
    // Fingers wrapping (curled)
    for (let i = 0; i < 4; i += 1) {
      const x = -0.06 + i * 0.04;
      addBox(group, [0.03, 0.05, 0.1], [x, -0.06, -0.4], this.materials.glove, [0.6, 0, 0]);
      addBox(group, [0.03, 0.05, 0.08], [x, -0.1, -0.36], this.materials.glove, [1.2, 0, 0]);
    }
    // Thumb wraps over
    addBox(group, [0.04, 0.05, 0.1], [isRight ? 0.08 : -0.08, 0.0, -0.36], this.materials.glove, [0.4, isRight ? -0.3 : 0.3, 0]);
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

    const rawSpeed = Math.hypot(player.velocity.x, player.velocity.z);
    // Smooth speed to prevent per-frame jitter
    this.smoothSpeed += (rawSpeed - this.smoothSpeed) * Math.min(1, dt * 8);

    // Sprint blend (gun lowered/holstered while running)
    const sprintTarget = player.sprinting ? 1 : 0;
    this.sprintBlend += (sprintTarget - this.sprintBlend) * Math.min(1, dt * 7);

    // Bob uses fixed frequency, smoothed amplitude — no jitter
    this.bobTime += dt * 8.4;
    this.shootKick = Math.max(0, this.shootKick - dt * 12);
    this.switchTime = Math.max(0, this.switchTime - dt * 5);
    this.reloadTime = Math.max(0, this.reloadTime - dt);
    this.flashTime = Math.max(0, this.flashTime - dt);

    const bobAmount = clamp(this.smoothSpeed / 6, 0, 1) * (1 - this.sprintBlend);
    const bobX = Math.sin(this.bobTime) * 0.014 * bobAmount;
    const bobY = Math.abs(Math.cos(this.bobTime)) * 0.016 * bobAmount;
    const recoil = this.shootKick;
    const reloadT = this.reloadDuration > 0 ? 1 - this.reloadTime / this.reloadDuration : 1;
    const reloadWave = this.reloadTime > 0 ? Math.sin(clamp(reloadT, 0, 1) * Math.PI) : 0;
    const switchDrop = this.switchTime * 0.2;

    // Sprint pose: drop and tilt the gun out of the way
    const sprintDropY = this.sprintBlend * 0.42;
    const sprintShiftX = this.sprintBlend * 0.12;
    const sprintShiftZ = this.sprintBlend * 0.18;
    const sprintTiltZ = this.sprintBlend * 0.6;
    const sprintTiltX = this.sprintBlend * 0.45;

    this.root.position.set(
      this.restPosition.x + bobX + sprintShiftX,
      this.restPosition.y - reloadWave * 0.18 - switchDrop + bobY - sprintDropY,
      this.restPosition.z + recoil * 0.12 + reloadWave * 0.08 + sprintShiftZ
    );
    this.root.rotation.set(
      this.restRotation.x - recoil * 0.12 - reloadWave * 0.2 + sprintTiltX,
      this.restRotation.y + recoil * 0.06,
      this.restRotation.z + bobX * 0.7 + reloadWave * 0.5 + sprintTiltZ
    );

    if (this.activeModel) {
      const model = this.activeModel;
      // Two-phase reload: 0..0.5 old mag drops out, 0.5..1 new mag slides up & seats
      if (model.magazine) {
        model.magazine.position.copy(model.magazine.userData.basePosition);
        model.magazine.rotation.copy(model.magazine.userData.baseRotation);
        if (this.reloadTime > 0) {
          const t = clamp(reloadT, 0, 1);
          const dropT = clamp(t / 0.45, 0, 1);
          // Old mag drops down and out
          model.magazine.position.y -= dropT * 0.95;
          model.magazine.rotation.x += dropT * 0.4;
          // Hide old mag once new mag is going in
          model.magazine.visible = t < 0.55;
        } else {
          model.magazine.visible = true;
        }
      }
      if (model.magazineNew) {
        if (this.reloadTime > 0) {
          const t = clamp(reloadT, 0, 1);
          const insertT = clamp((t - 0.5) / 0.4, 0, 1);
          if (t >= 0.5) {
            model.magazineNew.visible = true;
            const home = model.magazineNew.userData.basePosition;
            // Slide up from below into mag well; ease-out
            const eased = 1 - Math.pow(1 - insertT, 3);
            model.magazineNew.position.copy(home);
            model.magazineNew.position.y = home.y + (1 - eased) * -0.95;
            model.magazineNew.rotation.copy(model.magazineNew.userData.baseRotation);
            // Tiny seat-in click bounce at the very end
            if (insertT > 0.92) {
              const bounce = Math.sin((insertT - 0.92) / 0.08 * Math.PI) * 0.012;
              model.magazineNew.position.y -= bounce;
            }
          } else {
            model.magazineNew.visible = false;
          }
        } else {
          model.magazineNew.visible = false;
        }
      }
      if (model.bolt) {
        model.bolt.position.copy(model.bolt.userData.basePosition);
        model.bolt.rotation.copy(model.bolt.userData.baseRotation);
        model.bolt.position.z += recoil * 0.12;
        // Charging-handle pull at end of reload
        if (this.reloadTime > 0 && reloadT > 0.85) {
          const chT = (reloadT - 0.85) / 0.15;
          model.bolt.position.z += Math.sin(chT * Math.PI) * 0.16;
        }
      }
      if (model.leftHand) {
        model.leftHand.position.copy(model.leftHand.userData.basePosition);
        model.leftHand.rotation.copy(model.leftHand.userData.baseRotation);
        if (this.reloadTime > 0) {
          const t = clamp(reloadT, 0, 1);
          // Left hand reaches down for new mag, then up to seat it
          const reachT = clamp((t - 0.4) / 0.5, 0, 1);
          const reachCurve = Math.sin(reachT * Math.PI);
          model.leftHand.position.y -= reachCurve * 0.45;
          model.leftHand.position.x += reachCurve * 0.12;
          model.leftHand.position.z += reachCurve * 0.45;
          model.leftHand.rotation.z += reachCurve * 0.4;
        }
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
