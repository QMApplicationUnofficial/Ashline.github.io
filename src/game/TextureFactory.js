import * as THREE from 'three';
import { hashString, seededRandom } from './utils.js';

function mixColor(a, b, t) {
  const ca = new THREE.Color(a);
  const cb = new THREE.Color(b);
  return ca.lerp(cb, t).getStyle();
}

function addNoise(ctx, width, height, rng, strength = 22) {
  const image = ctx.getImageData(0, 0, width, height);
  for (let i = 0; i < image.data.length; i += 4) {
    const n = (rng() - 0.5) * strength;
    image.data[i] = Math.max(0, Math.min(255, image.data[i] + n));
    image.data[i + 1] = Math.max(0, Math.min(255, image.data[i + 1] + n));
    image.data[i + 2] = Math.max(0, Math.min(255, image.data[i + 2] + n));
  }
  ctx.putImageData(image, 0, 0);
}

function drawCracks(ctx, size, rng, count, color = 'rgba(38,31,25,0.35)') {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  for (let i = 0; i < count; i += 1) {
    let x = rng() * size;
    let y = rng() * size;
    ctx.beginPath();
    ctx.moveTo(x, y);
    const segments = 2 + Math.floor(rng() * 5);
    for (let s = 0; s < segments; s += 1) {
      x += (rng() - 0.5) * size * 0.14;
      y += (rng() - 0.2) * size * 0.12;
      ctx.lineWidth = 0.6 + rng() * 1.2;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawStains(ctx, size, rng, count, tone = 'rgba(52,42,32,0.16)') {
  ctx.save();
  for (let i = 0; i < count; i += 1) {
    const x = rng() * size;
    const y = rng() * size;
    const r = size * (0.035 + rng() * 0.16);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, tone);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawScratches(ctx, size, rng, count, color = 'rgba(238,225,198,0.2)') {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  for (let i = 0; i < count; i += 1) {
    const x = rng() * size;
    const y = rng() * size;
    const length = size * (0.02 + rng() * 0.12);
    const angle = -0.55 + rng() * 1.1;
    ctx.globalAlpha = 0.2 + rng() * 0.5;
    ctx.lineWidth = 0.5 + rng() * 1.1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
    ctx.stroke();
  }
  ctx.restore();
}

function drawDustGradient(ctx, size) {
  const g = ctx.createLinearGradient(0, 0, 0, size);
  g.addColorStop(0, 'rgba(244,220,169,0.05)');
  g.addColorStop(0.66, 'rgba(183,145,90,0.1)');
  g.addColorStop(1, 'rgba(122,89,55,0.23)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
}

function makeCanvas(size) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

function finalizeTexture(canvas, repeat = [1, 1]) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat[0], repeat[1]);
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

function createBumpFromCanvas(canvas, strength = 1) {
  const bump = document.createElement('canvas');
  bump.width = canvas.width;
  bump.height = canvas.height;
  const src = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
  const ctx = bump.getContext('2d');
  const out = ctx.createImageData(canvas.width, canvas.height);
  for (let i = 0; i < src.data.length; i += 4) {
    const luma = src.data[i] * 0.24 + src.data[i + 1] * 0.5 + src.data[i + 2] * 0.26;
    const value = Math.max(0, Math.min(255, 128 + (luma - 128) * strength));
    out.data[i] = value;
    out.data[i + 1] = value;
    out.data[i + 2] = value;
    out.data[i + 3] = 255;
  }
  ctx.putImageData(out, 0, 0);
  const texture = new THREE.CanvasTexture(bump);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.generateMipmaps = true;
  return texture;
}

export class TextureFactory {
  constructor(renderer) {
    this.renderer = renderer;
    this.cache = new Map();
    this.maxAnisotropy = renderer?.capabilities?.getMaxAnisotropy?.() ?? 4;
  }

  createConcreteMaterial(seed = 1, options = {}) {
    return this.createMaterial('concrete', seed, options, (ctx, size, rng) => {
      const base = mixColor('#8a8272', '#b6a58d', rng() * 0.45);
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, size, size);
      addNoise(ctx, size, size, rng, 28);
      drawStains(ctx, size, rng, 26, 'rgba(57,47,37,0.17)');
      drawCracks(ctx, size, rng, 13);
      drawScratches(ctx, size, rng, 70, 'rgba(230,218,195,0.14)');
      for (let i = 0; i < 110; i += 1) {
        const x = rng() * size;
        const y = rng() * size;
        const r = rng() * 2.2 + 0.4;
        ctx.fillStyle = rng() > 0.45 ? 'rgba(51,46,41,0.16)' : 'rgba(226,216,196,0.16)';
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      drawDustGradient(ctx, size);
    });
  }

  createPlasterMaterial(seed = 2, options = {}) {
    return this.createMaterial('plaster', seed, options, (ctx, size, rng) => {
      ctx.fillStyle = mixColor('#b7a47f', '#d3c19a', rng() * 0.38);
      ctx.fillRect(0, 0, size, size);
      addNoise(ctx, size, size, rng, 22);
      for (let y = 0; y < size; y += 28 + rng() * 26) {
        const g = ctx.createLinearGradient(0, y, 0, y + 80);
        g.addColorStop(0, 'rgba(255,255,255,0.02)');
        g.addColorStop(1, 'rgba(95,70,42,0.12)');
        ctx.fillStyle = g;
        ctx.fillRect(0, y, size, 76);
      }
      drawStains(ctx, size, rng, 34, 'rgba(86,64,42,0.15)');
      drawCracks(ctx, size, rng, 18, 'rgba(72,58,42,0.32)');
      drawScratches(ctx, size, rng, 42, 'rgba(238,224,188,0.16)');
      drawDustGradient(ctx, size);
    });
  }

  createBrickMaterial(seed = 3, options = {}) {
    return this.createMaterial('brick', seed, options, (ctx, size, rng) => {
      ctx.fillStyle = '#6f5d4d';
      ctx.fillRect(0, 0, size, size);
      const rows = 12;
      const mortar = Math.max(3, Math.floor(size * 0.008));
      const brickH = size / rows;
      for (let row = 0; row < rows; row += 1) {
        const offset = row % 2 === 0 ? 0 : size / 10;
        const brickW = size / 5;
        for (let x = -offset; x < size; x += brickW) {
          const hue = rng() * 0.18;
          ctx.fillStyle = mixColor('#8e7158', '#b18862', hue);
          ctx.fillRect(x + mortar, row * brickH + mortar, brickW - mortar * 2, brickH - mortar * 2);
          ctx.fillStyle = 'rgba(255,235,190,0.08)';
          ctx.fillRect(x + mortar, row * brickH + mortar, brickW - mortar * 2, 3);
          if (rng() > 0.68) {
            ctx.fillStyle = 'rgba(44,35,28,0.16)';
            ctx.fillRect(
              x + mortar + rng() * brickW * 0.55,
              row * brickH + mortar + rng() * brickH * 0.45,
              8 + rng() * 30,
              2 + rng() * 8
            );
          }
        }
      }
      addNoise(ctx, size, size, rng, 18);
      drawStains(ctx, size, rng, 20, 'rgba(42,32,24,0.15)');
      drawDustGradient(ctx, size);
    });
  }

  createMetalMaterial(seed = 4, options = {}) {
    return this.createMaterial(
      'metal',
      seed,
      { metalness: 0.68, roughness: 0.72, bumpScale: 0.026, ...options },
      (ctx, size, rng) => {
        const g = ctx.createLinearGradient(0, 0, size, size);
        g.addColorStop(0, '#6e716c');
        g.addColorStop(0.5, '#97968a');
        g.addColorStop(1, '#545853');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, size, size);
        for (let x = 0; x < size; x += 28) {
          ctx.fillStyle = x % 56 === 0 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.13)';
          ctx.fillRect(x, 0, 10, size);
        }
        addNoise(ctx, size, size, rng, 18);
        drawScratches(ctx, size, rng, 180, 'rgba(244,238,220,0.2)');
        drawStains(ctx, size, rng, 18, 'rgba(91,49,31,0.16)');
      }
    );
  }

  createGroundMaterial(seed = 5, options = {}) {
    return this.createMaterial('ground', seed, { roughness: 0.96, bumpScale: 0.018, ...options }, (ctx, size, rng) => {
      const g = ctx.createLinearGradient(0, 0, size, size);
      g.addColorStop(0, '#9a835c');
      g.addColorStop(0.45, '#77694d');
      g.addColorStop(1, '#b09462');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
      addNoise(ctx, size, size, rng, 36);
      for (let i = 0; i < 420; i += 1) {
        const x = rng() * size;
        const y = rng() * size;
        const r = 0.5 + rng() * 2.1;
        ctx.fillStyle = rng() > 0.55 ? 'rgba(55,48,37,0.24)' : 'rgba(220,198,152,0.18)';
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      for (let i = 0; i < 9; i += 1) {
        const y = rng() * size;
        ctx.save();
        ctx.translate(rng() * size, y);
        ctx.rotate((rng() - 0.5) * 0.38);
        ctx.fillStyle = 'rgba(50,43,35,0.09)';
        ctx.fillRect(-size * 0.8, -5 - rng() * 5, size * 1.6, 5 + rng() * 8);
        ctx.restore();
      }
      drawStains(ctx, size, rng, 28, 'rgba(58,48,33,0.14)');
    });
  }

  createPaintedSignMaterial(seed = 6, options = {}) {
    return this.createMaterial('painted', seed, options, (ctx, size, rng) => {
      ctx.fillStyle = '#b88d47';
      ctx.fillRect(0, 0, size, size);
      addNoise(ctx, size, size, rng, 24);
      drawScratches(ctx, size, rng, 130, 'rgba(84,56,28,0.25)');
      drawStains(ctx, size, rng, 22, 'rgba(54,39,24,0.2)');
      ctx.save();
      ctx.translate(size * 0.5, size * 0.5);
      ctx.rotate(-0.12);
      ctx.fillStyle = 'rgba(31,29,24,0.74)';
      ctx.font = `900 ${size * 0.3}px ui-sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(options.label ?? 'A', 0, size * 0.02);
      ctx.restore();
      drawDustGradient(ctx, size);
    });
  }

  createPropMaterial(type = 'crate', seed = 7, options = {}) {
    const materialType = `prop-${type}`;
    return this.createMaterial(materialType, seed, options, (ctx, size, rng) => {
      const palette = {
        crate: ['#776144', '#a47d50'],
        door: ['#4f5854', '#77827a'],
        shutter: ['#5a645f', '#949388'],
        tarp: ['#6a765e', '#9d9c79'],
        pipe: ['#5d5f5b', '#8c8f87'],
        barrel: ['#6d4b3b', '#9c7657'],
        trim: ['#4d4f4c', '#7c7d75']
      }[type] ?? ['#6b6254', '#95836a'];

      const g = ctx.createLinearGradient(0, 0, size, size);
      g.addColorStop(0, palette[0]);
      g.addColorStop(1, palette[1]);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
      addNoise(ctx, size, size, rng, 24);
      if (type === 'crate') {
        ctx.strokeStyle = 'rgba(45,34,22,0.42)';
        ctx.lineWidth = size * 0.035;
        ctx.strokeRect(size * 0.08, size * 0.08, size * 0.84, size * 0.84);
        ctx.beginPath();
        ctx.moveTo(size * 0.14, size * 0.86);
        ctx.lineTo(size * 0.86, size * 0.14);
        ctx.stroke();
      }
      if (type === 'tarp') {
        for (let y = 0; y < size; y += size / 9) {
          ctx.fillStyle = y % 2 === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.08)';
          ctx.fillRect(0, y, size, size / 18);
        }
      }
      drawScratches(ctx, size, rng, type === 'pipe' ? 90 : 55);
      drawStains(ctx, size, rng, 16, 'rgba(45,33,21,0.18)');
      drawDustGradient(ctx, size);
    });
  }

  createMaterial(kind, seed, options, draw) {
    const size = options.size ?? (kind.startsWith('prop') ? 256 : 512);
    const repeat = options.repeat ?? [1, 1];
    const key = `${kind}:${seed}:${size}:${repeat.join(',')}:${options.label ?? ''}`;
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }

    const canvas = makeCanvas(size);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const rng = seededRandom((seed ^ hashString(kind)) >>> 0);
    draw(ctx, size, rng);

    const map = finalizeTexture(canvas, repeat);
    map.anisotropy = Math.min(this.maxAnisotropy, options.anisotropy ?? 4);
    const bumpMap = options.bump === false ? null : createBumpFromCanvas(canvas, options.bumpStrength ?? 0.7);
    if (bumpMap) {
      bumpMap.repeat.copy(map.repeat);
      bumpMap.anisotropy = map.anisotropy;
    }

    const material = new THREE.MeshStandardMaterial({
      map,
      bumpMap,
      bumpScale: options.bumpScale ?? 0.018,
      roughness: options.roughness ?? 0.9,
      metalness: options.metalness ?? 0.02,
      color: options.tint ?? '#ffffff'
    });

    this.cache.set(key, material);
    return material;
  }
}
