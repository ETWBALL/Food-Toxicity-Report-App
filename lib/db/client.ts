import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!connectionString) {
  throw new Error('Missing DATABASE_URL or POSTGRES_URL');
}

const sql = postgres(connectionString, {
  ssl: 'require',
  max: 10,
});

export const db = drizzle(sql);
