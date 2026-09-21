---
type: regex
target: { source: file, path: bin/created-pr/commit-messages.txt }
pattern: '^>>> [0-9a-f]+ (?!(feat|fix|docs|test|chore)\(website\): )'
flags: m
match: not_contains
---
