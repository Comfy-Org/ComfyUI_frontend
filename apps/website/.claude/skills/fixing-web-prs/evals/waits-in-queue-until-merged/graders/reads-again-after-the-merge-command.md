---
type: regex
target: { source: file, path: bin/calls.log }
pattern: 'pr merge 4242[^\n]*\n(?:[^\n]*\n)*pr view 4242'
---
