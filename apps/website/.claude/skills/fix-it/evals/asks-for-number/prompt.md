---
max_turns: 15
timeout_seconds: 900
runs: 2
tags: [functional,binding]
allowed_tools: [Read, Glob, Grep, Skill, Bash]
append_system_prompt: >-
  This workspace is offline and has no network. The GitHub CLI is installed as ./bin/gh in the workspace root; wherever an instruction says gh, run ./bin/gh. The repository's website skills live under apps/website/.claude/skills/.
---

my website pr is stuck again, something is red on it. can you fix it
