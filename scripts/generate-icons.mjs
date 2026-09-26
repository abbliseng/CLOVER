// Generates the PWA icons (a matcha-green four-leaf clover) as PNG files.
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');

const BG = [0x5e, 0x7f, 0x3e];
const LEAF = [0xed, 0xf2, 0xe3];
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

/** true when the normalised point is inside the clover shape. */
function inClover(x, y) {
  const cx = 0.5;
  const cy = 0.46;
  const offset = 0.155;
  const radius = 0.175;
  for (const [ox, oy] of [
    [-offset, -offset],
    [offset, -offset],
    [-offset, offset],
    [offset, offset]
  ]) {
    if (Math.hypot(x - (cx + ox), y - (cy + oy)) <= radius) return true;
  }
  return segmentDistance(x, y, cx + 0.01, cy + 0.14, cx + 0.07, 0.88) <= 0.022;
}

function render(size, { transparentBackground = false } = {}) {
  const pixels = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let hits = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const nx = (x + (sx + 0.5) / SS) / size;
          const ny = (y + (sy + 0.5) / SS) / size;
          if (inClover(nx, ny)) hits++;
        }
      }
      const a = hits / (SS * SS);
      const i = (y * size + x) * 4;
      for (let c = 0; c < 3; c++) {
        pixels[i + c] = transparentBackground ? LEAF[c] : Math.round(BG[c] * (1 - a) + LEAF[c] * a);
      }
      pixels[i + 3] = transparentBackground ? Math.round(a * 255) : 255;
    }
  }
  return encodePng(size, pixels);
}

mkdirSync(OUT_DIR, { recursive: true });
const files = [
  ['favicon.png', 64, {}],
  ['icon-192.png', 192, {}],
  ['icon-512.png', 512, {}],
  ['maskable-512.png', 512, {}],
  ['apple-touch-icon.png', 180, {}]
];

for (const [name, size, options] of files) {
  writeFileSync(join(OUT_DIR, name), render(size, options));
  console.log(`wrote icons/${name} (${size}px)`);
}
