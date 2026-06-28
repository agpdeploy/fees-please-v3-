-- Add trial tracking to clubs table
ALTER TABLE clubs ADD COLUMN trial_ends_at timestamptz;
ALTER TABLE clubs ADD COLUMN has_had_trial boolean DEFAULT false;

COMMENT ON COLUMN clubs.trial_ends_at IS 'When the 14-day Plus trial ends. If null, no active trial.';
COMMENT ON COLUMN clubs.has_had_trial IS 'Whether this club has already used their 14-day trial.';
