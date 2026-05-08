import { distanceXZ, formatTime } from './utils.js';

export class RoundManager {
  constructor({ player, map, input, audio, onRoundEnd }) {
    this.player = player;
    this.map = map;
    this.input = input;
    this.audio = audio;
    this.onRoundEnd = onRoundEnd;
    this.attackers = 0;
    this.defenders = 0;
    this.roundNumber = 0;
    this.roundState = 'menu';
    this.roundTime = 115;
    this.buyTime = 0;
    this.bombPlanted = false;
    this.bombSite = null;
    this.bombTimer = 0;
    this.plantProgress = 0;
    this.defuseProgress = 0;
    this.interactionText = '';
    this.interactionProgress = 0;
    this.endTimer = 0;
    this.lastBeep = 0;
    this.needsRestart = false;
  }

  startRound() {
    this.roundNumber += 1;
    this.roundState = 'buy';
    this.roundTime = 115;
    this.buyTime = 7;
    this.bombPlanted = false;
    this.bombSite = null;
    this.bombTimer = 0;
    this.plantProgress = 0;
    this.defuseProgress = 0;
    this.interactionText = '';
    this.interactionProgress = 0;
    this.endTimer = 0;
    this.lastBeep = 0;
    this.needsRestart = false;
  }

  update(dt, bots) {
    this.interactionText = '';
    this.interactionProgress = 0;

    if (this.roundState === 'menu') return;
    if (this.roundState === 'ended') {
      this.endTimer -= dt;
      if (this.endTimer <= 0) this.needsRestart = true;
      return;
    }

    if (this.buyTime > 0) {
      this.buyTime = Math.max(0, this.buyTime - dt);
      if (this.buyTime === 0 && this.roundState === 'buy') this.roundState = 'live';
    }

    if (!this.player.alive) {
      this.endRound('defenders', 'Defenders held the line');
      return;
    }

    const aliveBots = bots.filter((bot) => bot.alive);
    if (aliveBots.length === 0) {
      this.endRound('attackers', 'Attackers cleared the district');
      return;
    }

    if (this.bombPlanted) {
      this.bombTimer -= dt;
      this.roundState = 'planted';
      this.defuseProgress = Math.max(0, this.defuseProgress - dt * 0.35);
      if (this.bombTimer <= 0) {
        this.endRound('attackers', `${this.bombSite.id} charge detonated`);
        return;
      }
      this.handleBombBeeps();
      return;
    }

    this.roundTime -= dt;
    if (this.roundTime <= 0) {
      this.endRound('defenders', 'Time expired');
      return;
    }

    this.handlePlant(dt);
  }

  handlePlant(dt) {
    const site = this.map.isInsideSite(this.player.position);
    if (!site) {
      this.plantProgress = 0;
      return;
    }

    this.interactionText = `Hold E to plant at Site ${site.id}`;
    if (this.input.isDown('KeyE')) {
      this.plantProgress += dt;
      this.interactionProgress = this.plantProgress / 3.1;
      if (this.plantProgress >= 3.1) {
        this.bombPlanted = true;
        this.bombSite = site;
        this.bombTimer = 38;
        this.plantProgress = 0;
        this.audio.beep(true);
      }
    } else {
      this.plantProgress = Math.max(0, this.plantProgress - dt * 1.5);
      this.interactionProgress = this.plantProgress / 3.1;
    }
  }

  botDefuse(dt, bot) {
    if (!this.bombPlanted || !this.bombSite || !bot.alive) return;
    if (distanceXZ(bot.position, this.bombSite.position) > 3.3) return;
    this.defuseProgress += dt;
    this.interactionText = `${bot.name} is defusing`;
    this.interactionProgress = this.defuseProgress / 5.3;
    if (this.defuseProgress >= 5.3) {
      this.endRound('defenders', `${bot.name} defused the charge`);
    }
  }

  handleBombBeeps() {
    const now = performance.now() * 0.001;
    const cadence = this.bombTimer < 8 ? 0.28 : this.bombTimer < 18 ? 0.55 : 1.1;
    if (now - this.lastBeep > cadence) {
      this.lastBeep = now;
      this.audio.beep(this.bombTimer < 10);
    }
  }

  endRound(winner, reason) {
    if (this.roundState === 'ended') return;
    if (winner === 'attackers') this.attackers += 1;
    if (winner === 'defenders') this.defenders += 1;
    this.roundState = 'ended';
    this.endTimer = 5;
    this.reason = reason;
    this.winner = winner;
    this.audio.round(winner === 'attackers');
    this.onRoundEnd?.(winner, reason);
  }

  getObjectiveText() {
    if (this.roundState === 'menu') return 'Ready';
    if (this.roundState === 'buy') return `Buy phase ${Math.ceil(this.buyTime)}s`;
    if (this.roundState === 'planted') return `Charge planted at ${this.bombSite.id}. ${formatTime(this.bombTimer)}`;
    if (this.roundState === 'ended') return this.reason ?? 'Round complete';
    return 'Plant the charge at Site A or B';
  }

  getTimerText() {
    if (this.roundState === 'planted') return formatTime(this.bombTimer);
    if (this.roundState === 'buy') return formatTime(this.buyTime);
    return formatTime(this.roundTime);
  }
}
