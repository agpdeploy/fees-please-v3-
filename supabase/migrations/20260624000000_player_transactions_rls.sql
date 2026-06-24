-- Allow players to view their own transactions
CREATE POLICY "Players can view their own transactions"
ON "public"."transactions"
AS PERMISSIVE FOR SELECT
TO authenticated
USING (
  auth.uid() IN (
    SELECT user_id 
    FROM public.players 
    WHERE id = transactions.player_id
  )
);
