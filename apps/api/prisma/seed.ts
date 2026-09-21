import { db } from '../src/db';
import { env } from '../src/env';
import { registerSchema } from '@abhaya/validation';
import { hashPassword } from '../src/security';
if (env.NODE_ENV === 'production')
  throw new Error('Development seeding is disabled in production.');
const input = registerSchema.parse({
  name: process.env.SEED_NAME,
  email: process.env.SEED_EMAIL,
  password: process.env.SEED_PASSWORD,
});
try {
  await db.user.upsert({
    where: { email: input.email },
    create: {
      name: input.name,
      email: input.email,
      passwordHash: await hashPassword(input.password),
    },
    update: {},
  });
  console.log(
    'Development user ready. No emergency contacts, incidents, locations or alerts were created.',
  );
} finally {
  await db.$disconnect();
}
