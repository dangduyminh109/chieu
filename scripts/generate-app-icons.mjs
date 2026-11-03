import sharp from 'sharp';
import { mkdir, copyFile } from 'node:fs/promises';

// Reuse the original brand artwork without cropping or redrawing it.
await mkdir('public/icons', { recursive: true });
for (const [size, padding, name] of [
  [192, 16, 'chieu-192.png'],
  [512, 42, 'chieu-512.png'],
  [512, 86, 'chieu-maskable-512.png'],
  [180, 16, 'chieu-apple-180.png'],
]) {
  const logo = await sharp('public/images/logo-icon.png')
    .resize(size - padding * 2, size - padding * 2, { fit: 'inside' })
    .toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: '#ffffff' } })
    .composite([{ input: logo, gravity: 'centre' }])
    .png()
    .toFile(`public/icons/${name}`);
}
await copyFile('public/icons/chieu-512.png', 'src/app/icon.png');
await copyFile('public/icons/chieu-apple-180.png', 'src/app/apple-icon.png');
