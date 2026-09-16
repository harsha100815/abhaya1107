import fs from 'node:fs/promises';
import path from 'node:path';
import type { DbState } from '../types.js';
import { config } from '../config.js';
import { seedState } from './seed-data.js';
import { Client } from 'pg';

/** File-backed store keeps demo mode deterministic and runnable without infrastructure. */
export class JsonStore {
  protected state!: DbState;
  protected filePath = path.resolve(config.dataDir, 'store.json');
  private writeQueue: Promise<void> = Promise.resolve();

  async init() {
    await fs.mkdir(config.dataDir, { recursive: true });
    try {
      const content = await fs.readFile(this.filePath, 'utf8');
      this.state = JSON.parse(content) as DbState;
    } catch {
      this.state = await seedState();
      await this.persist();
    }
    return this;
  }

  get data() {
    if (!this.state) throw new Error('Store has not been initialized');
    return this.state;
  }

  protected hydrate(state: DbState) { this.state = state; }

  async persist() {
    const serialized = JSON.stringify(this.state, null, 2);
    this.writeQueue = this.writeQueue.then(async () => {
      const tempPath = `${this.filePath}.tmp`;
      await fs.writeFile(tempPath, serialized, 'utf8');
      await fs.rename(tempPath, this.filePath);
    });
    await this.writeQueue;
  }

  async reset() {
    this.state = await seedState();
    await this.persist();
  }
}

/**
 * PostgreSQL-backed runtime snapshot adapter. The relational schema/migration is the source of
 * truth for production modeling; the snapshot table lets this MVP run the same route logic while
 * a repository-per-domain is introduced without changing the safety workflows.
 */
export class PostgresStore extends JsonStore {
  private client: Client;
  constructor(connectionString: string) {
    super();
    this.client = new Client({ connectionString });
  }

  override async init() {
    await this.client.connect();
    await this.client.query(`CREATE TABLE IF NOT EXISTS abhaya_runtime_state (id integer PRIMARY KEY, state jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`);
    const result = await this.client.query<{ state: DbState }>('SELECT state FROM abhaya_runtime_state WHERE id = 1');
    if (result.rows[0]?.state) this.hydrate(result.rows[0].state);
    else { this.hydrate(await seedState()); await this.persist(); }
    return this;
  }

  override async persist() {
    await this.client.query(
      `INSERT INTO abhaya_runtime_state (id, state, updated_at) VALUES (1, $1::jsonb, now()) ON CONFLICT (id) DO UPDATE SET state = EXCLUDED.state, updated_at = now()`,
      [JSON.stringify(this.data)],
    );
  }

  override async reset() {
    this.hydrate(await seedState());
    await this.persist();
  }
}
