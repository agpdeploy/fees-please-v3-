-- Allow Team Admins to view all transactions within their club
CREATE POLICY "Team Admins can view club transactions"
ON "public"."transactions"
AS PERMISSIVE FOR SELECT
TO authenticated
USING (
  auth.uid() IN (
    SELECT user_roles.user_id 
    FROM public.user_roles 
    WHERE user_roles.club_id = transactions.club_id 
    AND user_roles.role = 'team_admin'
  )
);
