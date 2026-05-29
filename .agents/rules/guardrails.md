# Agent Guardrails

The agent must strictly adhere to the following guardrails:

1. **No Deployments**: Do not deploy code or trigger deployment builds to production or staging environments unless the user explicitly requests it.
2. **Access to Environment Files**: Do not read or view `.env.local` (or any other local environment/secrets files) directly. If the agent needs configuration keys or environment variables, it must ask the user for the specific details it needs.
3. **Direct Code Modification**: The agent is authorized to create, update, and modify code files directly during development without showing visual code diffs or seeking confirmation before each edit.
