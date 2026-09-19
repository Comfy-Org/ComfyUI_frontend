---
type: regex
target: { source: file, path: bin/created-pr/commit-messages.txt }
pattern: '^(feat|fix|docs|test|chore)\(website\): '
flags: m
---
