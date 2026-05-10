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
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      dietary_restrictions JSONB DEFAULT '[]'::jsonb
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS user_allergies (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS user_medications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS user_conditions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
      recall_description TEXT,
      recall_date TIMESTAMP,
      recall_expiry_date TIMESTAMP,
      severity_level VARCHAR(64),
      issuing_authority VARCHAR(255),
      official_recall_url TEXT,
      recall_number VARCHAR(255),
      affected_batch_numbers TEXT,
      affected_upc_codes TEXT,
      source VARCHAR(64) DEFAULT 'FDA',
      active BOOLEAN DEFAULT TRUE,
      updated_at TIMESTAMP DEFAULT NOW(),
      created_at TIMESTAMP DEFAULT NOW()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS scan_history (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
      barcode VARCHAR(64),
      score INTEGER DEFAULT 0,
      verdict VARCHAR(32) DEFAULT 'Caution',
      scanned_at TIMESTAMP DEFAULT NOW(),
      created_at TIMESTAMP DEFAULT NOW()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS reports (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
      scan_id INTEGER REFERENCES scan_history(id) ON DELETE SET NULL,
      score INTEGER DEFAULT 0,
      verdict VARCHAR(32) DEFAULT 'Caution',
      report_date TIMESTAMP DEFAULT NOW(),
      overall_score INTEGER,
      allergen_score INTEGER,
      toxicity_score INTEGER,
      recall_score INTEGER,
      drug_interaction_score INTEGER,
      adverse_event_score INTEGER,
      known_reactions TEXT,
      potential_harms JSONB DEFAULT '[]'::jsonb,
      allergen_flags TEXT,
      drug_flags TEXT,
      toxicity_flags TEXT,
      severity_level VARCHAR(64),
      is_personalized BOOLEAN DEFAULT FALSE,
      fda_report_count INTEGER,
      fda_reaction_summary TEXT,
      nutritional_score INTEGER,
      calories INTEGER,
      sugar_level VARCHAR(64),
      sodium_level VARCHAR(64),
      saturated_fat_level VARCHAR(64),
      protein_level VARCHAR(64),
      fiber_level VARCHAR(64),
      nutritional_flags TEXT,
      nutritional_summary TEXT,
      daily_value_warnings TEXT,
      condition_flags TEXT,
      ai_analysis_summary TEXT,
      summary TEXT,
      updated_at TIMESTAMP DEFAULT NOW(),
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
