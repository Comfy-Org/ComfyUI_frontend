---
type: regex
target: { source: file, path: bin/events.log }
pattern: 'merge accepted #4242[^\n]*\n(?:[^\n]*\n)*view CLOSED '
---
