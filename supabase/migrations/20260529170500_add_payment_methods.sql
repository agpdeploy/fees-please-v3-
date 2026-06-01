-- Add accepted payment methods to clubs table
ALTER TABLE public.clubs
ADD COLUMN IF NOT EXISTS accepts_cash boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS accepts_card boolean NOT NULL DEFAULT true;

-- Ensure at least one method is accepted (can't have a club that accepts no payments!)
ALTER TABLE public.clubs
ADD CONSTRAINT ensure_one_payment_method CHECK (accepts_cash = true OR accepts_card = true);
