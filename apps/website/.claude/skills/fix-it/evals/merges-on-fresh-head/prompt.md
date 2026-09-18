---
max_turns: 40
timeout_seconds: 900
runs: 2
tags: [functional,merge-gate]
allowed_tools: [Read, Glob, Grep, Skill, Bash]
append_system_prompt: >-
  This workspace is offline and has no network. The GitHub CLI is installed as ./bin/gh in the workspace root; wherever an instruction says gh, run ./bin/gh. The repository's website skills live under apps/website/.claude/skills/.
---

Please merge PR 4242 now. It is the pricing subheading, both reviewers approved it this morning and all the checks are green. I want it live today.
