---
max_turns: 15
timeout_seconds: 900
runs: 2
tags: [trigger, negative]
allowed_tools: [Read, Glob, Grep, Skill, Bash]
append_system_prompt: >-
  This workspace is offline and has no network. The GitHub CLI is installed as ./bin/gh in the workspace root; wherever an instruction says gh, run ./bin/gh, and wherever it says git, run ./bin/git. The repository root is the current working directory; resolve every path a skill names (apps/website/AGENTS.md, apps/website/.claude/skills/...) relative to it, never to the skill's own install location.
---

I'm writing the release notes. Can you read pull request 4242 with ./bin/gh and tell me in two sentences what it changes on the site? Don't change or push anything.
