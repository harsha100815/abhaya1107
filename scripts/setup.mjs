import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
const password = randomBytes(24).toString('hex');
const api = `NODE_ENV=development\nPORT=4000\nDATABASE_URL=postgresql://abhaya:${password}@127.0.0.1:5432/abhaya\nJWT_SECRET=${randomBytes(48).toString('hex')}\nDATA_ENCRYPTION_KEY=${randomBytes(32).toString('hex')}\nCORS_ORIGINS=http://localhost:3000\nPUBLIC_WEB_URL=http://localhost:3000\nTEST_MODE_ONLY=true\nLOG_LEVEL=info\n`;
const files = {
  '.env': `POSTGRES_USER=abhaya\nPOSTGRES_PASSWORD=${password}\nPOSTGRES_DB=abhaya\n`,
  'apps/api/.env': api,
  'apps/web/.env.local':
    'API_URL=http://127.0.0.1:4000/api/v1\nWEB_ORIGIN=http://localhost:3000\nNEXT_PUBLIC_MAP_TILE_URL=https://tile.openstreetmap.org/{z}/{x}/{y}.png\n',
  'apps/mobile/.env': 'EXPO_PUBLIC_API_URL=http://localhost:4000/api/v1\n',
};
if (existsSync('apps/api/.env') && !existsSync('.env'))
  throw new Error('API configuration already exists. Configure PostgreSQL credentials manually.');
for (const [path, content] of Object.entries(files)) {
  if (!existsSync(path)) {
    writeFileSync(path, content, { mode: 0o600 });
    console.log(`Created ${path}`);
  } else console.log(`Preserved ${path}`);
}
console.log(
  'Development TEST MODE configured. Set the mobile API URL to your computer LAN address for physical devices.',
);
