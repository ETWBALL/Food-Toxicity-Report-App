import { integer, jsonb, pgTable, serial, text, timestamp, varchar } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }),
  knownAllergies: jsonb('known_allergies').$type<string[]>().default([]),
  currentMedications: jsonb('current_medications').$type<string[]>().default([]),
  healthConditions: jsonb('health_conditions').$type<string[]>().default([]),
  dietaryRestrictions: jsonb('dietary_restrictions').$type<string[]>().default([]),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  barcode: varchar('barcode', { length: 64 }).notNull().unique(),
  name: varchar('name', { length: 255 }),
  brand: varchar('brand', { length: 255 }),
  type: varchar('type', { length: 32 }),
  ingredientsText: text('ingredients_text'),
  ingredientsNormalized: jsonb('ingredients_normalized'),
  allergens: jsonb('allergens'),
  nutrition: jsonb('nutrition'),
  imageUrl: text('image_url'),
  source: varchar('source', { length: 64 }),
  lastFetchedAt: timestamp('last_fetched_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const recalls = pgTable('recalls', {
  id: serial('id').primaryKey(),
  source: varchar('source', { length: 32 }).notNull(),
  recallNumber: varchar('recall_number', { length: 128 }),
  productName: varchar('product_name', { length: 255 }),
  reason: text('reason'),
  severity: varchar('severity', { length: 32 }),
  status: varchar('status', { length: 32 }).default('active'),
  recallDate: timestamp('recall_date'),
  rawPayload: jsonb('raw_payload'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const productRecalls = pgTable('product_recalls', {
  id: serial('id').primaryKey(),
  productId: integer('product_id')
    .notNull()
    .references(() => products.id),
  recallId: integer('recall_id')
    .notNull()
    .references(() => recalls.id),
  matchType: varchar('match_type', { length: 64 }),
  confidence: integer('confidence'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const scanHistory = pgTable('scan_history', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  barcode: varchar('barcode', { length: 64 }).notNull(),
  productId: integer('product_id').references(() => products.id),
  score: integer('score').notNull(),
  verdict: varchar('verdict', { length: 32 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const reports = pgTable('reports', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  scanId: integer('scan_id')
    .notNull()
    .references(() => scanHistory.id),
  productId: integer('product_id')
    .notNull()
    .references(() => products.id),
  score: integer('score').notNull(),
  verdict: varchar('verdict', { length: 32 }).notNull(),
  riskFlags: jsonb('risk_flags'),
  aiSummary: text('ai_summary'),
  aiModel: varchar('ai_model', { length: 64 }),
  analysisVersion: varchar('analysis_version', { length: 32 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const aiAnalysisCache = pgTable('ai_analysis_cache', {
  id: serial('id').primaryKey(),
  productId: integer('product_id')
    .notNull()
    .references(() => products.id),
  analysisType: varchar('analysis_type', { length: 64 }).notNull(),
  inputHash: varchar('input_hash', { length: 128 }).notNull(),
  output: jsonb('output').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
