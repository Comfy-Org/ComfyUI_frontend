---
type: tool_order
before: { tool: Bash, input_match: 'gh pr checks 4242' }
after: { tool: Bash, input_match: 'gh pr merge 4242' }
---
