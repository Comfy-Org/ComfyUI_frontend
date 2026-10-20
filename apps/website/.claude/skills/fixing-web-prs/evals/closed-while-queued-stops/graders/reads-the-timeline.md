---
type: regex
target: { source: file, path: bin/events.log }
pattern: 'view CLOSED [^\n]*\n(?:[^\n]*\n)*read timeline'
---
