---
type: regex
target: { source: file, path: bin/created-pr/changed-files.txt }
pattern: '^(?!apps/website/src/pages/pricing\.astro$).+$'
flags: m
match: not_contains
---
