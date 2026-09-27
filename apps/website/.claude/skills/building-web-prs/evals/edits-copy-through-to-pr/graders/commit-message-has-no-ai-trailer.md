---
type: regex
target: { source: file, path: bin/created-pr/commit-messages.txt }
pattern: 'co-authored-by|noreply@anthropic|claude|claude-session'
flags: i
match: not_contains
---
