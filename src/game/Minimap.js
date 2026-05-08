import { WORLD_BOUNDS } from './utils.js';

export class Minimap {
  constructor(canvas, map) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.map = map;
    this.size = 168;
    this.scaleX = this.size / (WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX);
    this.scaleZ = this.size / (WORLD_BOUNDS.maxZ - WORLD_BOUNDS.minZ);
  }

  worldToMap(point) {
    return {
      x: (point.x - WORLD_BOUNDS.minX) * this.scaleX,
      y: (point.z - WORLD_BOUNDS.minZ) * this.scaleZ
    };
  }

  draw(player, bots, round) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.size, this.size);
    ctx.fillStyle = 'rgba(12, 14, 13, 0.82)';
    ctx.fillRect(0, 0, this.size, this.size);

    ctx.save();
    ctx.strokeStyle = 'rgba(239,226,198,0.13)';
    ctx.lineWidth = 1;
    for (const collider of this.map.colliders) {
      const a = this.worldToMap(collider.aabb.min);
      const b = this.worldToMap(collider.aabb.max);
      ctx.fillStyle = 'rgba(224,210,174,0.12)';
      ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
      ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
    }

    for (const site of this.map.sites) {
      const p = this.worldToMap(site.position);
      ctx.beginPath();
      ctx.arc(p.x, p.y, site.radius * this.scaleX, 0, Math.PI * 2);
      ctx.fillStyle = site.id === 'A' ? 'rgba(231,168,68,0.22)' : 'rgba(105,189,208,0.2)';
      ctx.fill();
      ctx.fillStyle = '#f1eadb';
      ctx.font = '800 14px ui-sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(site.id, p.x, p.y);
    }

    if (round.bombPlanted && round.bombSite) {
      const p = this.worldToMap(round.bombSite.position);
      ctx.strokeStyle = '#e7a844';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 10 + Math.sin(performance.now() * 0.012) * 2, 0, Math.PI * 2);
      ctx.stroke();
    }

    for (const bot of bots) {
      if (!bot.alive) continue;
      const visible = bot.canSee(player.camera.position) || round.bombPlanted;
      if (!visible) continue;
      const p = this.worldToMap(bot.position);
      ctx.fillStyle = '#69bdd0';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    const pp = this.worldToMap(player.position);
    ctx.translate(pp.x, pp.y);
    ctx.rotate(-player.yaw);
    ctx.fillStyle = '#e7a844';
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 5);
    ctx.lineTo(0, 2);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
