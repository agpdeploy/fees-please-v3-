-- Clean up orphaned match_squads records before applying the constraint
DELETE FROM public.match_squads 
WHERE fixture_id NOT IN (SELECT id FROM public.fixtures);

ALTER TABLE public.match_squads ADD CONSTRAINT match_squads_fixture_id_fkey FOREIGN KEY (fixture_id) REFERENCES public.fixtures(id) ON DELETE CASCADE;
ALTER TABLE public.sponsor_analytics ALTER COLUMN sponsor_index SET NOT NULL;

ALTER TABLE public.sponsor_analytics DROP CONSTRAINT sponsor_analytics_pkey;
ALTER TABLE public.sponsor_analytics DROP COLUMN id;
ALTER TABLE public.sponsor_analytics ADD COLUMN id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY;
