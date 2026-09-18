---
max_turns: 15
timeout_seconds: 900
runs: 2
tags: [trigger, negative]
allowed_tools: [Read, Glob, Grep, Skill, Bash]
append_system_prompt: >-
  This workspace is offline and has no network. The GitHub CLI is installed as ./bin/gh in the workspace root; wherever an instruction says gh, run ./bin/gh. The repository's website skills live under apps/website/.claude/skills/.
---

I'm writing the release notes. Can you read pull request 4242 with ./bin/gh and tell me in two sentences what it changes on the site? Don't change or push anything.
