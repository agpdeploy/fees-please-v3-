-- Add the columns if they don't exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES public.profiles(id);

-- Backfill existing profiles with a referral code (first 8 chars of their uuid)
UPDATE public.profiles 
SET referral_code = SUBSTRING(id::TEXT FROM 1 FOR 8) 
WHERE referral_code IS NULL;

-- Function to handle auto-generating referral code
CREATE OR REPLACE FUNCTION public.handle_new_user_referral()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-generate a referral code if one isn't provided
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := SUBSTRING(NEW.id::TEXT FROM 1 FOR 8);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call the function on insert
DROP TRIGGER IF EXISTS on_profile_created_referral ON public.profiles;
CREATE TRIGGER on_profile_created_referral
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_referral();
