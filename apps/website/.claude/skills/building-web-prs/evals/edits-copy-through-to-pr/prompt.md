---
max_turns: 60
timeout_seconds: 1200
runs: 2
tags: [functional, workflow]
allowed_tools: [Read, Glob, Grep, Skill, Bash, Edit, Write]
append_system_prompt: >-
  This workspace is offline and has no network, no browser, no dev server, and no pnpm. The GitHub CLI is installed as ./bin/gh in the workspace root; wherever an instruction says gh, run ./bin/gh, and where a step needs a browser, a dev server, or a package script, skip it and say so in the hand-off. The repository's website skills live under apps/website/.claude/skills/. Time passes instantly here: when a skill says to wait before reading again, read again straight away.
---

Small copy change on the pricing page please: the line under the Pricing heading currently says "Start free, upgrade when you need more." and it should say "Start free, pay as you grow." Nothing else changes. Take it through to a pull request I can send to the engineers.
