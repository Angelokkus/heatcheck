// Rasterize src/assets/icon.svg → PNG icons (16/48/128) for the manifest.
// Run: node scripts/gen-icons.mjs
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';

const svg = await readFile('src/assets/icon.svg');

for (const size of [16, 48, 128]) {
  await sharp(svg, { density: 512 })
    .resize(size, size)
    .png()
    .toFile(`src/assets/icon-${size}.png`);
  console.log(`wrote src/assets/icon-${size}.png`);
}
