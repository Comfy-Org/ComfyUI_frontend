---
type: regex
target: { source: file, path: bin/events.log }
pattern: '^merge accepted #4242 at [0-9a-f]{40}$'
flags: m
match: 'count:1'
---
