import * as THREE from 'three';
import { AudioManager } from './AudioManager.js';
import { Bot } from './Bot.js';
import { DecalManager } from './DecalManager.js';
import { HUD } from './HUD.js';
import { InputManager } from './InputManager.js';
import { MapBuilder } from './MapBuilder.js';
import { ParticleSystem } from './ParticleSystem.js';
import { Player } from './Player.js';
import { Renderer3D } from './Renderer3D.js';
import { RoundManager } from './RoundManager.js';
import { SettingsStore } from './SettingsStore.js';
import { TextureFactory } from './TextureFactory.js';
import { WeaponSystem } from './WeaponSystem.js';

export class Game {
  constructor(root) {
    this.root = root;
    this.settings = new SettingsStore();
    this.renderer3D = new Renderer3D(root, this.settings);
    this.renderer3D.scene.add(this.renderer3D.camera);
    this.input = new InputManager(this.renderer3D.renderer.domElement);
    this.audio = new AudioManager(this.settings);
    this.textureFactory = new TextureFactory(this.renderer3D.renderer);
    this.map = new MapBuilder(this.renderer3D.scene, this.textureFactory).build();
    this.particles = new ParticleSystem(this.renderer3D.scene, this.settings);
    this.decals = new DecalManager(this.renderer3D.scene);
    this.player = new Player(
      this.renderer3D.camera,
      this.input,
      this.map,
      this.settings,
      this.particles,
      this.audio
    );
    this.particles.seedAround(this.player.position);
    this.bots = this.createBots();
    this.round = new RoundManager({
      player: this.player,
      map: this.map,
      input: this.input,
      audio: this.audio,
      onRoundEnd: (winner, reason) => this.handleRoundEnd(winner, reason)
    });
    this.weapons = new WeaponSystem({
      player: this.player,
      input: this.input,
      camera: this.renderer3D.camera,
      scene: this.renderer3D.scene,
      map: this.map,
      particles: this.particles,
      decals: this.decals,
      audio: this.audio,
      onHit: () => this.hud?.showHit(),
      onKill: (bot, weapon) => this.hud?.addKill('You', bot.name, weapon.name)
    });
    this.hud = new HUD(root, this.map, this.settings, {
      onStart: () => this.begin(),
      onResume: () => this.resume(),
      onRestart: () => this.resetRound(),
      onWeaponSelect: (index) => this.weapons.select(index)
    });

    this.state = 'menu';
    this.clock = new THREE.Clock();
    this.lastFrame = 0;
    this.settings.subscribe((values) => {
      this.renderer3D.applySettings(values);
      this.particles.applySettings(values);
      this.audio.setVolume(values.volume);
    });
    this.renderer3D.renderer.domElement.addEventListener('click', () => {
      if (this.state === 'playing') this.input.requestPointerLock();
    });
  }

  createBots() {
    const bots = [];
    for (let i = 0; i < 5; i += 1) {
      bots.push(new Bot(i, this.renderer3D.scene, this.map, this.particles, this.audio));
    }
    return bots;
  }

  start() {
    this.loop();
  }

  async begin() {
    await this.audio.resume();
    this.hud.showMain(false);
    this.hud.showPause(false);
    this.hud.showSettings(false);
    this.hud.showBuy(false);
    this.state = 'playing';
    this.resetRound();
    this.input.requestPointerLock();
  }

  async resume() {
    await this.audio.resume();
    this.state = 'playing';
    this.hud.showPause(false);
    this.hud.showSettings(false);
    this.input.requestPointerLock();
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    document.exitPointerLock?.();
    this.hud.showPause(true);
  }

  resetRound() {
    this.player.reset(this.map.attackerSpawn);
    this.weapons.resetAmmo();
    this.round.startRound();
    this.bots.forEach((bot, index) => bot.reset(this.map.defenderSpawns[index % this.map.defenderSpawns.length]));
    this.particles.seedAround(this.player.position);
  }

  handleRoundEnd(winner, reason) {
    const label = winner === 'attackers' ? 'Attackers' : 'Defenders';
    this.hud.addKill(label, 'Round', reason);
  }

  update(dt) {
    if (this.input.consume('Escape')) {
      if (this.state === 'playing') this.pause();
      else if (this.state === 'paused') this.resume();
    }

    if (this.state === 'playing' && this.input.consume('KeyB') && this.round.buyTime > 0) {
      this.hud.showBuy(true);
    }

    if (this.round.needsRestart) this.resetRound();

    if (this.state === 'playing') {
      this.player.update(dt);
      const weaponsEnabled = this.round.roundState !== 'ended';
      this.weapons.update(dt, this.bots, weaponsEnabled);
      this.round.update(dt, this.bots);
      for (const bot of this.bots) {
        bot.update(dt, this.player, this.round);
      }
    } else {
      this.weapons.update(dt, this.bots, false);
    }

    this.particles.update(dt, this.player.position);
    this.hud.update({
      player: this.player,
      weapons: this.weapons,
      round: this.round,
      bots: this.bots
    });
  }

  loop() {
    requestAnimationFrame(() => this.loop());
    const dt = Math.min(0.05, this.clock.getDelta());
    this.lastFrame += dt;
    this.update(dt);
    this.renderer3D.render();
  }
}
