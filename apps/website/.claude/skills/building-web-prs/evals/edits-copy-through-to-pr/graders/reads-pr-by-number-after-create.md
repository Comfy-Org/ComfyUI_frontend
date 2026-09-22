---
type: tool_order
before: { tool: Bash, input_match: 'gh pr create' }
after: { tool: Bash, input_match: 'gh pr (view|checks) 4242' }
---
