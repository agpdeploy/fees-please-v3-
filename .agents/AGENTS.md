# Project-Scoped Rules

- Do not push changes to the production branch (`main`) unless the user explicitly instructs you to do so. Work should be pushed to the staging branch (`staging`) or a specific feature branch.

- **Security Rule (Service Role Key):** Whenever writing or modifying a Next.js API route that uses the `SUPABASE_SERVICE_ROLE_KEY` (which bypasses Row Level Security), you MUST explicitly implement authorization checks in the server logic. Always verify that the authenticated user (derived securely from the session cookie) owns the record or has the appropriate admin rights for the associated club before performing any database mutations.
