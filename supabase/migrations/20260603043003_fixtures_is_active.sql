-- Add is_active flag for soft deactivation on fixtures
ALTER TABLE public.fixtures ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
