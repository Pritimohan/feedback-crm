-- Migration: App-level key-value settings (admin-configurable, not env)
-- Used for per-brand Exotel Exophones (CallerId): exotel_exophone_fitty / exotel_exophone_fitelo.

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
