---
type: regex
target: { source: file, path: bin/events.log }
pattern: 'merge accepted\n(?:[^\n]*\n)*view MERGED '
---
