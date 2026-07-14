CREATE TABLE IF NOT EXISTS audit_submissions (
  id UUID PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  clinic_name TEXT NOT NULL,
  city TEXT NOT NULL,
  website TEXT,
  instagram TEXT,
  devices JSONB NOT NULL DEFAULT '[]'::jsonb,
  finance_status TEXT NOT NULL,
  provider_count TEXT,
  live_review_consent BOOLEAN NOT NULL DEFAULT FALSE,
  anonymous_review BOOLEAN NOT NULL DEFAULT FALSE,
  answers JSONB NOT NULL,
  score INTEGER NOT NULL,
  blind_spot INTEGER NOT NULL,
  unknown_count INTEGER NOT NULL,
  burn_flag BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS audit_submissions_created_at_idx
  ON audit_submissions (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_submissions_score_idx
  ON audit_submissions (score ASC);
CREATE INDEX IF NOT EXISTS audit_submissions_blind_spot_idx
  ON audit_submissions (blind_spot DESC);
