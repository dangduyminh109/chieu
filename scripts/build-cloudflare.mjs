import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const cli = path.resolve('node_modules/@opennextjs/cloudflare/dist/cli/index.js');
const result = spawnSync(process.execPath, [cli, 'build', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env, NEXT_PUBLIC_APP_URL: 'https://staging.chieudinhyen.store' },
});
if (result.status !== 0) process.exit(result.status ?? 1);

// Runtime secrets belong in Cloudflare secrets, never in the deployable bundle.
const envPath = path.resolve('.open-next/cloudflare/next-env.mjs');
const content = fs.readFileSync(envPath, 'utf8');
const safeContent = content.replace(
  /export const (production|development|test) = (.*);/g,
  (_, mode, json) => {
    const safe = Object.fromEntries(
      Object.entries(JSON.parse(json)).filter(([key]) => key.startsWith('NEXT_PUBLIC_')),
    );
    safe.NEXT_PUBLIC_APP_URL = 'https://staging.chieudinhyen.store';
    return `export const ${mode} = ${JSON.stringify(safe)};`;
  },
);
fs.writeFileSync(envPath, safeContent);
console.log('Cloudflare bundle ready; runtime secrets are excluded from environment snapshots.');
