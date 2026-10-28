import { parseEnv } from './config';
export { parseEnv } from './config';
export type { Env } from './config';
export const env = parseEnv(process.env);
