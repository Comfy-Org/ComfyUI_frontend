---
type: tool_order
before: { tool: Bash, input_match: 'git (checkout|switch) -[bc]' }
after: { tool: Bash, input_match: 'git commit' }
---
