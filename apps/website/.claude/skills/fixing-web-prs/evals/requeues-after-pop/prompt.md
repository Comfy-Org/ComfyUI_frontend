---
max_turns: 60
timeout_seconds: 1200
runs: 2
tags: [functional, merge-gate, queue]
allowed_tools: [Read, Glob, Grep, Skill, Bash]
append_system_prompt: >-
  This workspace is offline and has no network. The GitHub CLI is installed as ./bin/gh in the workspace root; wherever an instruction says gh, run ./bin/gh, and wherever it says git, run ./bin/git. The repository root is the current working directory; resolve every path a skill names (apps/website/AGENTS.md, apps/website/.claude/skills/...) relative to it, never to the skill's own install location. Time passes instantly here: when a skill says to wait a few minutes before reading again, read again straight away instead of sleeping.
---

Please merge PR 4242 now. It is the pricing subheading, both reviewers approved it this morning and all the checks are green. I want it live today.
