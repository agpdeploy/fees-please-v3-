-- Add subscription tracking to clubs
ALTER TABLE public.clubs 
ADD COLUMN plan_tier text NOT NULL DEFAULT 'free',
ADD COLUMN override_platform_fee boolean NOT NULL DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.clubs.plan_tier IS 'Subscription tier (free, plus, pro)';
COMMENT ON COLUMN public.clubs.override_platform_fee IS 'If true, ignores the platform fee clip entirely and only charges wholesale processing fees';
