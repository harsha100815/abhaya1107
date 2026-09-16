import { JsonStore, PostgresStore } from './store.js';
import { config } from '../config.js';

const store = await (config.databaseMode === 'postgres' && config.databaseUrl ? new PostgresStore(config.databaseUrl) : new JsonStore()).init();
await store.reset();
console.log('ABHAYA demo data seeded.');
