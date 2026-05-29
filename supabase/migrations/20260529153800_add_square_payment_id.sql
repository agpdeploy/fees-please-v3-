-- Add square_payment_id to transactions table
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS square_payment_id text;

-- Add index to speed up lookups by square_payment_id when refunding
CREATE INDEX IF NOT EXISTS transactions_square_payment_id_idx ON public.transactions(square_payment_id);
