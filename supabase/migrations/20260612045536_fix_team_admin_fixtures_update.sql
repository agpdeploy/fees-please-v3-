DROP POLICY IF EXISTS "Team Admins can update their own fixtures" ON "public"."fixtures";

CREATE POLICY "Team Admins can update their own fixtures"
ON "public"."fixtures"
AS permissive
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE (
      user_roles.team_id = fixtures.team_id
      AND user_roles.role = ANY (ARRAY['team_admin'::text, 'club_admin'::text])
      AND (user_roles.user_id = auth.uid() OR user_roles.email = (auth.jwt() ->> 'email'::text))
    )
  )
);
