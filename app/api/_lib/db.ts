import postgres from 'postgres';

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('Missing POSTGRES_URL or DATABASE_URL');
}

export const sql = postgres(connectionString, { ssl: 'require' });

let initialized = false;

export async function ensureApiTables() {
  if (initialized) return;

  await sql`
    CREATE TABLE IF NOT EXISTS "UserProfile" (
      user_id INTEGER PRIMARY KEY REFERENCES "User"(id) ON DELETE CASCADE,
      dietary_restrictions JSONB DEFAULT '[]'::jsonb
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS user_allergies (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
      name TEXT NOT NULL
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS user_medications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
      name TEXT NOT NULL
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS user_conditions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
      name TEXT NOT NULL
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      barcode VARCHAR(64) UNIQUE NOT NULL,
      name VARCHAR(255),
      brand VARCHAR(255),
      ingredients TEXT,
      nutritional_info JSONB,
      image_url TEXT,
      type VARCHAR(64),
      fda BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS recalls (
      id SERIAL PRIMARY KEY,
      product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
      barcode VARCHAR(64),
      recall_reason TEXT,
      recall_date TIMESTAMP,
      severity_level VARCHAR(64),
      source VARCHAR(64) DEFAULT 'FDA',
      active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS scan_history (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
      product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
      barcode VARCHAR(64),
      score INTEGER DEFAULT 0,
      verdict VARCHAR(32) DEFAULT 'Caution',
      created_at TIMESTAMP DEFAULT NOW()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS reports (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
      product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
      scan_id INTEGER REFERENCES scan_history(id) ON DELETE SET NULL,
      score INTEGER DEFAULT 0,
      verdict VARCHAR(32) DEFAULT 'Caution',
      potential_harms JSONB DEFAULT '[]'::jsonb,
      summary TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS ai_analysis_cache (
      id SERIAL PRIMARY KEY,
      product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
      analysis_type VARCHAR(64) NOT NULL,
      content JSONB NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(product_id, analysis_type)
    );
  `;

  await sql`ALTER TABLE recalls ADD COLUMN IF NOT EXISTS recall_number VARCHAR(128)`;
  await sql`ALTER TABLE recalls ADD COLUMN IF NOT EXISTS affected_upc_codes TEXT[]`;
  await sql`ALTER TABLE recalls ADD COLUMN IF NOT EXISTS official_recall_url TEXT`;

  initialized = true;
}
