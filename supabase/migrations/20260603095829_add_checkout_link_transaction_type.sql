ALTER TABLE public.transactions DROP CONSTRAINT transactions_transaction_type_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_transaction_type_check CHECK (transaction_type = ANY (ARRAY['payment'::text, 'fee'::text, 'expense'::text, 'checkout_link'::text]));
