import * as THREE from 'three';
import { makeAabb, WORLD_BOUNDS } from './utils.js';

export class MapBuilder {
  constructor(scene, textureFactory) {
    this.scene = scene;
    this.textures = textureFactory;
    this.colliders = [];
    this.worldMeshes = [];
    this.decorMeshes = [];
    this.sites = [
      { id: 'A', position: new THREE.Vector3(-31, 0, -22), radius: 5.8 },
      { id: 'B', position: new THREE.Vector3(30, 0, 19), radius: 5.8 }
    ];
    this.attackerSpawn = new THREE.Vector3(0, 0, 36);
    this.defenderSpawns = [
      new THREE.Vector3(-28, 0, -32),
      new THREE.Vector3(30, 0, -28),
      new THREE.Vector3(-36, 0, 14),
      new THREE.Vector3(36, 0, 6),
      new THREE.Vector3(3, 0, -30)
    ];
    this.patrolPoints = [
      new THREE.Vector3(-30, 0, -21),
      new THREE.Vector3(-18, 0, -5),
      new THREE.Vector3(0, 0, -16),
      new THREE.Vector3(19, 0, -4),
      new THREE.Vector3(31, 0, 18),
      new THREE.Vector3(13, 0, 26),
      new THREE.Vector3(-12, 0, 18),
      new THREE.Vector3(-34, 0, 13)
    ];
    this.coverPoints = [
      new THREE.Vector3(-22, 0, -19),
      new THREE.Vector3(-36, 0, -12),
      new THREE.Vector3(-5, 0, -7),
      new THREE.Vector3(17, 0, -13),
      new THREE.Vector3(35, 0, 10),
      new THREE.Vector3(22, 0, 23),
      new THREE.Vector3(-8, 0, 27),
      new THREE.Vector3(6, 0, 8)
    ];
  }

  build() {
    this.createGround();
    this.createBoundary();
    this.createDistrictBlocks();
    this.createCoverAndProps();
    this.createSites();
    this.createOverheadDetails();
    return this;
  }

  createGround() {
    const floorMaterial = this.textures.createGroundMaterial(11, {
      size: 1024,
      repeat: [8, 7],
      bumpScale: 0.02
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(96, 84), floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    floor.userData.surface = 'dust';
    this.scene.add(floor);
    this.worldMeshes.push(floor);
  }

  createBoundary() {
    const mat = this.textures.createConcreteMaterial(16, { repeat: [3, 1.2] });
    this.addBox('north-wall', [0, 3, -42.5], [98, 6, 2], mat, true);
    this.addBox('south-wall', [0, 3, 42.5], [98, 6, 2], mat, true);
    this.addBox('west-wall', [-48.5, 3, 0], [2, 6, 86], mat, true);
    this.addBox('east-wall', [48.5, 3, 0], [2, 6, 86], mat, true);
  }

  createDistrictBlocks() {
    const plasterA = this.textures.createPlasterMaterial(31, { repeat: [2.5, 2.5] });
    const plasterB = this.textures.createPlasterMaterial(33, { repeat: [2, 2.2], tint: '#f3e5c5' });
    const concrete = this.textures.createConcreteMaterial(34, { repeat: [2, 2] });
    const brick = this.textures.createBrickMaterial(35, { repeat: [2, 2] });
    const metal = this.textures.createMetalMaterial(36, { repeat: [1.2, 1.5] });

    const buildings = [
      ['a-office', [-37, 4.4, -27], [13, 8.8, 18], plasterA],
      ['a-warehouse', [-18, 5.3, -31], [15, 10.6, 14], brick],
      ['north-factory', [7, 5.2, -31], [24, 10.4, 13], concrete],
      ['b-stack', [34, 4.8, -24], [16, 9.6, 20], plasterB],
      ['mid-kiosk', [-8, 3.1, -7], [13, 6.2, 10], plasterB],
      ['mid-workshop', [16, 3.8, -9], [15, 7.6, 12], brick],
      ['west-apartments', [-38, 4.5, 3], [14, 9, 22], plasterB],
      ['south-yard-left', [-23, 3.3, 24], [20, 6.6, 13], concrete],
      ['south-yard-right', [21, 4.2, 32], [25, 8.4, 12], plasterA],
      ['b-market', [37, 4.2, 16], [14, 8.4, 20], brick]
    ];

    for (const [name, position, size, material] of buildings) {
      this.addBox(name, position, size, material, true);
      this.addRoofTrim(position, size);
      this.addWallDetails(position, size, metal);
    }

    this.addBox('mid-long-wall-1', [-23, 2.1, -2], [3, 4.2, 16], concrete, true);
    this.addBox('mid-long-wall-2', [28, 2.2, -3], [3, 4.4, 18], concrete, true);
    this.addBox('b-site-back', [28, 2.5, 30], [22, 5, 3], concrete, true);
    this.addBox('a-site-back', [-31, 2.5, -12], [23, 5, 3], concrete, true);
  }

  addRoofTrim(position, size) {
    const trim = this.textures.createPropMaterial('trim', Math.floor(position[0] * 5 + position[2] * 7 + 100), {
      repeat: [1.5, 0.5],
      metalness: 0.35,
      roughness: 0.82
    });
    this.addBox(`${position[0]}-roof-front`, [position[0], position[1] + size[1] * 0.51, position[2] + size[2] * 0.52], [size[0] + 0.5, 0.35, 0.55], trim, false);
    this.addBox(`${position[0]}-roof-back`, [position[0], position[1] + size[1] * 0.51, position[2] - size[2] * 0.52], [size[0] + 0.5, 0.35, 0.55], trim, false);
  }

  addWallDetails(position, size, metal) {
    const [x, y, z] = position;
    const [sx, sy, sz] = size;
    const doorMat = this.textures.createPropMaterial('door', Math.floor(x * 11 - z * 3 + 210), { repeat: [1, 1.4] });
    const shutterMat = this.textures.createPropMaterial('shutter', Math.floor(x * 13 + z * 5 + 90), { repeat: [1, 1] });

    if (sx > sz) {
      this.addBox(`door-${x}-${z}`, [x - sx * 0.22, 1.35, z + sz * 0.515], [2.4, 2.7, 0.18], doorMat, false);
      this.addBox(`shutter-${x}-${z}`, [x + sx * 0.2, 3.2, z + sz * 0.52], [3.2, 1.6, 0.16], shutterMat, false);
      this.addBox(`vent-${x}-${z}`, [x + sx * 0.36, 5.6, z + sz * 0.53], [2.2, 0.8, 0.2], metal, false);
    } else {
      this.addBox(`door-${x}-${z}`, [x + sx * 0.515, 1.35, z - sz * 0.22], [0.18, 2.7, 2.4], doorMat, false);
      this.addBox(`shutter-${x}-${z}`, [x + sx * 0.52, 3.2, z + sz * 0.18], [0.16, 1.6, 3.2], shutterMat, false);
      this.addBox(`vent-${x}-${z}`, [x + sx * 0.53, 5.6, z + sz * 0.34], [0.2, 0.8, 2.2], metal, false);
    }
  }

  createCoverAndProps() {
    const concrete = this.textures.createConcreteMaterial(47, { repeat: [1, 1] });
    const crate = this.textures.createPropMaterial('crate', 48, { repeat: [1, 1] });
    const barrel = this.textures.createPropMaterial('barrel', 49, { repeat: [1, 1] });
    const metal = this.textures.createMetalMaterial(50, { repeat: [1, 1] });
    const tarp = this.textures.createPropMaterial('tarp', 51, { repeat: [1.4, 1] });

    const cover = [
      ['a-crates-1', [-28, 1, -20], [5, 2, 3], crate],
      ['a-crates-2', [-35, 0.8, -17], [3, 1.6, 4], crate],
      ['a-low-wall', [-22, 1.1, -17], [8, 2.2, 1.2], concrete],
      ['mid-slab', [0, 1.2, -5], [8, 2.4, 1.3], concrete],
      ['mid-crate', [7, 1, 4], [4, 2, 4], crate],
      ['mid-metal', [21, 1.1, 4], [7, 2.2, 1.5], metal],
      ['b-crates-1', [27, 1, 17], [5, 2, 4], crate],
      ['b-crates-2', [35, 1.1, 23], [4, 2.2, 5], crate],
      ['south-cover-1', [-8, 0.9, 25], [6, 1.8, 3], crate],
      ['south-cover-2', [8, 1, 28], [6, 2, 3], tarp],
      ['west-cover', [-39, 1, 17], [4, 2, 5], crate],
      ['north-cover', [1, 1, -21], [5, 2, 4], metal]
    ];

    for (const [name, pos, size, mat] of cover) {
      this.addBox(name, pos, size, mat, true);
    }

    for (const [x, z] of [
      [-32, -5],
      [-14, 8],
      [12, -18],
      [33, 1],
      [24, 24],
      [-16, 31]
    ]) {
      this.addCylinder(`barrel-${x}-${z}`, [x, 0.8, z], 0.75, 1.6, barrel, true);
    }

    this.addPipeRun([
      [-43, 4.7, -7],
      [-33, 4.9, -7],
      [-24, 4.5, -10]
    ]);
    this.addPipeRun([
      [24, 5.2, 10],
      [34, 5.1, 10],
      [42, 4.8, 14]
    ]);
  }

  createSites() {
    for (const site of this.sites) {
      const material = this.textures.createPaintedSignMaterial(site.id === 'A' ? 61 : 62, {
        label: site.id,
        size: 512,
        roughness: 0.86
      });
      const marker = new THREE.Mesh(new THREE.CircleGeometry(site.radius, 48), material);
      marker.rotation.x = -Math.PI / 2;
      marker.position.copy(site.position).add(new THREE.Vector3(0, 0.012, 0));
      marker.receiveShadow = true;
      marker.userData.surface = 'paint';
      this.scene.add(marker);
      this.worldMeshes.push(marker);

      const sign = new THREE.Mesh(new THREE.PlaneGeometry(5, 3), material);
      sign.position.set(site.position.x, 2.7, site.position.z + (site.id === 'A' ? 6.2 : -6.2));
      sign.rotation.y = site.id === 'A' ? Math.PI : 0;
      sign.castShadow = true;
      sign.receiveShadow = true;
      this.scene.add(sign);
      this.worldMeshes.push(sign);
    }
  }

  createOverheadDetails() {
    const cableMat = new THREE.MeshStandardMaterial({
      color: '#232522',
      roughness: 0.85,
      metalness: 0.15
    });

    const cables = [
      [
        [-42, 7.5, -3],
        [-18, 8.8, -8],
        [4, 7.8, -3],
        [27, 8.4, -10]
      ],
      [
        [-14, 7, 30],
        [2, 8.1, 21],
        [20, 7.7, 25],
        [39, 8.5, 18]
      ]
    ];
    for (const points of cables) {
      const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
      const cable = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.045, 6, false), cableMat);
      cable.castShadow = true;
      this.scene.add(cable);
      this.decorMeshes.push(cable);
    }
  }

  addPipeRun(points) {
    const pipeMat = this.textures.createPropMaterial('pipe', points.length * 13 + 70, {
      repeat: [1, 1],
      metalness: 0.45,
      roughness: 0.78
    });
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
    const pipe = new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.16, 9, false), pipeMat);
    pipe.castShadow = true;
    pipe.receiveShadow = true;
    this.scene.add(pipe);
    this.decorMeshes.push(pipe);
  }

  addBox(name, position, size, material, collidable = true) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), material);
    mesh.name = name;
    mesh.position.set(position[0], position[1], position[2]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.surface = material.metalness > 0.2 ? 'metal' : 'dust';
    this.scene.add(mesh);
    this.worldMeshes.push(mesh);

    if (collidable) {
      const center = new THREE.Vector3(position[0], position[1], position[2]);
      const extent = new THREE.Vector3(size[0], size[1], size[2]);
      this.colliders.push({
        name,
        mesh,
        aabb: makeAabb(center, extent)
      });
    } else {
      this.decorMeshes.push(mesh);
    }

    return mesh;
  }

  addCylinder(name, position, radius, height, material, collidable = true) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 18), material);
    mesh.name = name;
    mesh.position.set(position[0], position[1], position[2]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.surface = 'metal';
    this.scene.add(mesh);
    this.worldMeshes.push(mesh);

    if (collidable) {
      this.colliders.push({
        name,
        mesh,
        aabb: makeAabb(new THREE.Vector3(...position), new THREE.Vector3(radius * 2, height, radius * 2))
      });
    }
    return mesh;
  }

  isInsideSite(position) {
    return this.sites.find((site) => site.position.distanceTo(position) <= site.radius);
  }

  clampToWorld(position) {
    position.x = THREE.MathUtils.clamp(position.x, WORLD_BOUNDS.minX + 1, WORLD_BOUNDS.maxX - 1);
    position.z = THREE.MathUtils.clamp(position.z, WORLD_BOUNDS.minZ + 1, WORLD_BOUNDS.maxZ - 1);
    return position;
  }
}
