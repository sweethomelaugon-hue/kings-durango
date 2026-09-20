CREATE TABLE IF NOT EXISTS ios_push_tokens (
  token TEXT PRIMARY KEY,
  platform TEXT NOT NULL DEFAULT 'ios',
  bundle_id TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE ios_push_tokens ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE ios_push_tokens FROM anon, authenticated;
GRANT ALL ON TABLE ios_push_tokens TO service_role;
