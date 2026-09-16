import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';

/**
 * PostgreSQL migration runner. The API's demo provider uses a durable JSON store so it can run
 * without external services; production deployments set DATABASE_MODE=postgres and apply this SQL.
 */
const sqlPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../prisma/migrations/0001_init/migration.sql');
const run = async () => {
  try {
    const sql = await fs.readFile(sqlPath, 'utf8');
    if (config.databaseMode !== 'postgres' || !config.databaseUrl) {
      console.log(`Database mode is ${config.databaseMode}; SQL migration is ready at ${sqlPath} (${sql.length} bytes).`);
      return;
    }
    const { Client } = await import('pg');
    const client = new Client({ connectionString: config.databaseUrl });
    await client.connect();
    await client.query(sql);
    await client.end();
    console.log('PostgreSQL migration applied.');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exitCode = 1;
  }
};
void run();
