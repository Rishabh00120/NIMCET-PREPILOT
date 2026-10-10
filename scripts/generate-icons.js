import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const svgPath = path.resolve('public/icon.svg');
const svgBuffer = fs.readFileSync(svgPath);

async function generate() {
  console.log('Generating PWA icons...');

  // 1. pwa-192x192.png
  await sharp(svgBuffer)
    .resize(192, 192)
    .png()
    .toFile(path.resolve('public/pwa-192x192.png'));
  console.log('Generated pwa-192x192.png');

  // 2. pwa-512x512.png
  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.resolve('public/pwa-512x512.png'));
  console.log('Generated pwa-512x512.png');

  // 3. apple-touch-icon.png (180x180)
  await sharp(svgBuffer)
    .resize(180, 180)
    .png()
    .toFile(path.resolve('public/apple-touch-icon.png'));
  console.log('Generated apple-touch-icon.png');

  // 4. favicon.ico / favicon (32x32 / 48x48)
  await sharp(svgBuffer)
    .resize(48, 48)
    .png()
    .toFile(path.resolve('public/favicon.ico'));
  console.log('Generated favicon.ico');

  // 5. pwa-maskable-512x512.png:
  // Android safe-zone has 15-20% margin. We create a 512x512 canvas with #0F172A background,
  // and place a 400x400 scaled version centered.
  const innerScaled = await sharp(svgBuffer)
    .resize(390, 390)
    .toBuffer();

  await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 15, g: 23, b: 42, alpha: 1 }, // #0F172A
    },
  })
    .composite([
      {
        input: innerScaled,
        top: 61,
        left: 61,
      },
    ])
    .png()
    .toFile(path.resolve('public/pwa-maskable-512x512.png'));
  console.log('Generated pwa-maskable-512x512.png with safe-zone padding');
}

generate().catch((err) => {
  console.error(err);
  process.exit(1);
});
