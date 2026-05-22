# Agent Guardrails

The agent must strictly adhere to the following guardrails:

1. **Read-Only Terminal Mode**: The agent operates in a read-only terminal mode.
2. **Visual Code Diffs**: The agent must always show the user a visual code diff for explicit approval before making any file changes.
3. **Zero Deployment Permissions**: The agent has zero deployment permissions and is not authorized to trigger or manage deployments.
