-- Drop the broad read policies
DROP POLICY IF EXISTS "Profiles are viewable by club members" ON "public"."profiles";
DROP POLICY IF EXISTS "Users can view profiles" ON "public"."profiles";

-- Create a secure select policy
CREATE POLICY "Users can view profiles in their own clubs or teams"
ON "public"."profiles"
FOR SELECT
TO authenticated
USING (
  -- User is viewing their own profile
  auth.uid() = id
  OR
  -- User is a member of a club/team where the profile owner is also a member
  EXISTS (
    SELECT 1 
    FROM public.user_roles own_role
    JOIN public.user_roles other_role ON (
      own_role.club_id = other_role.club_id 
      OR own_role.team_id = other_role.team_id
    )
    WHERE own_role.user_id = auth.uid() 
      AND other_role.user_id = profiles.id
  )
);
