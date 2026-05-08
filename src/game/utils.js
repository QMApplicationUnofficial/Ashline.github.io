import * as THREE from 'three';

export const WORLD_BOUNDS = {
  minX: -48,
  maxX: 48,
  minZ: -42,
  maxZ: 42
};

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function easeOut(t) {
  return 1 - Math.pow(1 - clamp(t, 0, 1), 3);
}

export function formatTime(seconds) {
  const safe = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${minutes}:${rest.toString().padStart(2, '0')}`;
}

export function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function hashString(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function makeAabb(center, size, padding = 0) {
  return {
    min: new THREE.Vector3(
      center.x - size.x * 0.5 - padding,
      center.y - size.y * 0.5 - padding,
      center.z - size.z * 0.5 - padding
    ),
    max: new THREE.Vector3(
      center.x + size.x * 0.5 + padding,
      center.y + size.y * 0.5 + padding,
      center.z + size.z * 0.5 + padding
    )
  };
}

export function pointInAabbXZ(point, aabb, radius = 0) {
  return (
    point.x + radius > aabb.min.x &&
    point.x - radius < aabb.max.x &&
    point.z + radius > aabb.min.z &&
    point.z - radius < aabb.max.z
  );
}

export function resolveAabbCollisionXZ(position, previous, radius, colliders) {
  const next = position.clone();

  for (const collider of colliders) {
    if (!pointInAabbXZ(next, collider.aabb, radius)) continue;

    const xFromLeft = Math.abs(next.x + radius - collider.aabb.min.x);
    const xFromRight = Math.abs(collider.aabb.max.x - (next.x - radius));
    const zFromBack = Math.abs(next.z + radius - collider.aabb.min.z);
    const zFromFront = Math.abs(collider.aabb.max.z - (next.z - radius));
    const minOverlap = Math.min(xFromLeft, xFromRight, zFromBack, zFromFront);

    if (minOverlap === xFromLeft && previous.x + radius <= collider.aabb.min.x) {
      next.x = collider.aabb.min.x - radius;
    } else if (minOverlap === xFromRight && previous.x - radius >= collider.aabb.max.x) {
      next.x = collider.aabb.max.x + radius;
    } else if (minOverlap === zFromBack && previous.z + radius <= collider.aabb.min.z) {
      next.z = collider.aabb.min.z - radius;
    } else if (minOverlap === zFromFront && previous.z - radius >= collider.aabb.max.z) {
      next.z = collider.aabb.max.z + radius;
    } else {
      next.x = previous.x;
      next.z = previous.z;
    }
  }

  next.x = clamp(next.x, WORLD_BOUNDS.minX, WORLD_BOUNDS.maxX);
  next.z = clamp(next.z, WORLD_BOUNDS.minZ, WORLD_BOUNDS.maxZ);
  return next;
}

export function distanceXZ(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.hypot(dx, dz);
}

export function angleToVector(yaw) {
  return new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
}

export function rotateVector2(x, z, yaw) {
  const sin = Math.sin(yaw);
  const cos = Math.cos(yaw);
  return new THREE.Vector3(x * cos + z * sin, 0, z * cos - x * sin);
}

export function createCircleTexture(color = '#ffffff') {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 31);
  gradient.addColorStop(0, color);
  gradient.addColorStop(0.42, color);
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
