-- 1. Ensure all missing billing columns are added
ALTER TABLE public.clubs 
  ADD COLUMN IF NOT EXISTS plan_tier text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS override_platform_fee boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS accepts_cash boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS accepts_card boolean NOT NULL DEFAULT true;

-- 2. Add email_type to email_logs
ALTER TABLE public.email_logs
  ADD COLUMN IF NOT EXISTS email_type text DEFAULT 'availability';

-- 3. Clean up orphaned rows
DELETE FROM public.ai_logs WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM auth.users);
UPDATE public.players SET user_id = NULL WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM public.profiles);
DELETE FROM public.profiles WHERE id NOT IN (SELECT id FROM auth.users);

-- 4. Reconcile sponsor_analytics to UUID (Matches Prod natively)
ALTER TABLE public.sponsor_analytics DROP CONSTRAINT IF EXISTS sponsor_analytics_pkey;
ALTER TABLE public.sponsor_analytics DROP COLUMN IF EXISTS id;
ALTER TABLE public.sponsor_analytics ADD COLUMN id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY;
ALTER TABLE public.sponsor_analytics ALTER COLUMN sponsor_index DROP NOT NULL;
ALTER TABLE public.sponsor_analytics ALTER COLUMN sponsor_index TYPE smallint;

-- 5. Add missing foreign keys
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_id_fkey') THEN
        ALTER TABLE public.profiles ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'players_user_id_fkey') THEN
        ALTER TABLE public.players ADD CONSTRAINT players_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_logs_user_id_fkey') THEN
        ALTER TABLE public.ai_logs ADD CONSTRAINT ai_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 6. Clean up match_squads orphans and add constraint
DELETE FROM public.match_squads WHERE fixture_id NOT IN (SELECT id FROM public.fixtures);
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'match_squads_fixture_id_fkey') THEN
        ALTER TABLE public.match_squads ADD CONSTRAINT match_squads_fixture_id_fkey FOREIGN KEY (fixture_id) REFERENCES public.fixtures(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 7. Add square_payment_id
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS square_payment_id text;

-- 8. Fix transactions constraint
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_transaction_type_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_transaction_type_check 
  CHECK (transaction_type = ANY (ARRAY['payment'::text, 'fee'::text, 'expense'::text, 'checkout_link'::text]));
