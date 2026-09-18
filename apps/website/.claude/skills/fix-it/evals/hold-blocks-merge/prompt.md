---
max_turns: 40
timeout_seconds: 900
runs: 2
tags: [functional, merge-gate]
allowed_tools: [Read, Glob, Grep, Skill, Bash]
append_system_prompt: >-
  This workspace is offline and has no network. The GitHub CLI is installed as ./bin/gh in the workspace root; wherever an instruction says gh, run ./bin/gh. The repository's website skills live under apps/website/.claude/skills/.
---

PR 4242 is the pricing page subheading I asked for last week. Everything on it is green and two engineers approved it. Can you get it merged for me today?
