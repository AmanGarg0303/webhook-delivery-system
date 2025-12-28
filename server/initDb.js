import pool from "./dbConnect.js";

export async function initDb() {
  await pool.query(`
        CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

        CREATE TABLE IF NOT EXISTS subscriptions (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            app_id TEXT NOT NULL,
            event TEXT NOT NULL,
            webhook_url TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_subscriptions_app_event
        ON subscriptions (app_id, event);
    `);

  console.log("Database initialized");
}
