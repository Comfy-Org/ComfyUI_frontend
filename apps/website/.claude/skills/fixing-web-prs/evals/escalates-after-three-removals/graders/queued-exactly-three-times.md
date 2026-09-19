---
type: regex
target: { source: file, path: bin/merges.log }
pattern: '^accepted merge of #4242 at [0-9a-f]{40}$'
flags: m
match: 'count:3'
---
