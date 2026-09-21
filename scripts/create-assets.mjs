import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
const svg = await readFile('apps/mobile/assets/mark.svg');
await sharp(svg).png().toFile('apps/mobile/assets/icon.png');
await sharp(svg)
  .resize(650, 650)
  .extend({ top: 187, bottom: 187, left: 187, right: 187, background: '#245C43' })
  .png()
  .toFile('apps/mobile/assets/adaptive-icon.png');
await sharp(svg).resize(320, 320).png().toFile('apps/mobile/assets/splash-icon.png');
