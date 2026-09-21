import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { env } from './env';
export const db = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: env.DATABASE_URL,
    max: env.DB_POOL_MAX,
    connectionTimeoutMillis: 5000,
    statement_timeout: 10000,
  }),
});
export type Tx = Prisma.TransactionClient;
export async function lockUser(tx: Tx, userId: string) {
  await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId}::uuid FOR UPDATE`;
}
