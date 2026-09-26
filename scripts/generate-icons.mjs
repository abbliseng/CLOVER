// Generates the PWA icons (a matcha-green four-leaf clover) as PNG files.
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');

const BG = [0x4f, 0x6b, 0x33];
const LEAF_LIGHT = [0xa6, 0xd1, 0x74];
const LEAF_DARK = [0x84, 0xb8, 0x4f];
const SS = 3; // supersampling factor

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(data.length + 12);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function encodePng(size, pixels) {
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

/** Distance from point to a line segment, used for the stem. */
function segmentDistance(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

const CENTRE_X = 0.5;
const CENTRE_Y = 0.45;
const LEAF_SCALE = 0.15;

// Four hearts with their points meeting in the middle, alternating shades.
const LEAVES = [
  { angle: -135, colour: LEAF_LIGHT },
  { angle: -45, colour: LEAF_DARK },
  { angle: 135, colour: LEAF_DARK },
  { angle: 45, colour: LEAF_LIGHT }
].map(({ angle, colour }) => {
  const rad = (angle * Math.PI) / 180;
  return { ox: Math.cos(rad), oy: Math.sin(rad), colour };
});

/** Classic heart curve, with its point at the local origin. */
function inHeart(u, v) {
  const r = u * u + v * v - 1;
  return r * r * r - u * u * v * v * v <= 0;
}

function colourAt(x, y) {
  const dx = x - CENTRE_X;
  const dy = y - CENTRE_Y;

  for (const leaf of LEAVES) {
    const outward = dx * leaf.ox + dy * leaf.oy;
    const across = dx * -leaf.oy + dy * leaf.ox;
    // Slight overshoot past the centre, so the four points meet without a seam.
    if (inHeart(across / LEAF_SCALE, outward / LEAF_SCALE - 0.9)) return leaf.colour;
  }

  if (segmentDistance(x, y, CENTRE_X, CENTRE_Y + 0.08, CENTRE_X, 0.9) <= 0.016) return LEAF_DARK;
  return null;
}

function render(size) {
  const pixels = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sum = [0, 0, 0];
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const colour = colourAt((x + (sx + 0.5) / SS) / size, (y + (sy + 0.5) / SS) / size) ?? BG;
          for (let c = 0; c < 3; c++) sum[c] += colour[c];
        }
      }
      const i = (y * size + x) * 4;
      for (let c = 0; c < 3; c++) pixels[i + c] = Math.round(sum[c] / (SS * SS));
      pixels[i + 3] = 255;
    }
  }
  return encodePng(size, pixels);
}

mkdirSync(OUT_DIR, { recursive: true });
const files = [
  ['favicon.png', 64],
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['maskable-512.png', 512],
  ['apple-touch-icon.png', 180]
];

for (const [name, size] of files) {
  writeFileSync(join(OUT_DIR, name), render(size));
  console.log(`wrote icons/${name} (${size}px)`);
}
