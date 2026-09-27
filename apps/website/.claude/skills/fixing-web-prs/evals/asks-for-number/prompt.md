---
max_turns: 15
timeout_seconds: 900
runs: 2
tags: [functional, binding]
allowed_tools: [Read, Glob, Grep, Skill, Bash]
append_system_prompt: >-
  This workspace is offline and has no network. The GitHub CLI is installed as ./bin/gh in the workspace root; wherever an instruction says gh, run ./bin/gh, and wherever it says git, run ./bin/git. The repository root is the current working directory; resolve every path a skill names (apps/website/AGENTS.md, apps/website/.claude/skills/...) relative to it, never to the skill's own install location.
---

my website pr is stuck again, something is red on it. can you fix it
