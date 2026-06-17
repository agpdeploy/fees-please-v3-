ALTER TABLE public.profiles ADD COLUMN referred_by UUID REFERENCES public.profiles(id);
