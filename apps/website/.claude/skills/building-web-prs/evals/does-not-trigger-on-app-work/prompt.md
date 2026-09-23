---
max_turns: 10
timeout_seconds: 600
runs: 2
tags: [trigger, negative]
allowed_tools: [Read, Glob, Grep, Skill]
---

In src/lib/litegraph the node title text clips when the canvas is zoomed below 50%. Can you look at how LGraphCanvas draws titles and suggest where the fix should go? This is the editor app, not the marketing site.
