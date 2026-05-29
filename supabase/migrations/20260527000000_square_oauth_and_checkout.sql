-- Add Square OAuth fields to clubs
ALTER TABLE public.clubs
ADD COLUMN IF NOT EXISTS square_refresh_token text,
ADD COLUMN IF NOT EXISTS square_merchant_id text;

-- Add status column to transactions to support online checkout states
-- New fees will be created with status 'unpaid' when a checkout link is generated, 
-- and updated to 'paid' upon successful Square payment.
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS status text;
