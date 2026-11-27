# Benchmarks and structure diagrams

For performance and architecture PRs. When the fix should be proven in CI,
follow `.claude/skills/perf-fix-with-proof/SKILL.md`; this file covers what
goes in the PR body.

## Benchmarks

- Run main and the branch on the same machine in one session, interleaved
  (main, branch, main, branch, ...), so drift in machine load hits both
  sides equally. Build both sides the same way, in a worktree for main.
- Do at least 5 runs per side, more when the spread overlaps.
- Report the median with the min–max range and the run count for each side,
  plus the ratio of medians. A single number, or a mean without its range,
  does not count.
- State the machine, the exact command, and both SHAs.

```markdown
<details>
<summary>Benchmark: load a 500-node workflow</summary>

Command: `pnpm bench:load --fixture large-500` on one machine, interleaved, 8 runs per side.

| Side             | Median | Range      | Runs |
| ---------------- | ------ | ---------- | ---- |
| main `abc1234`   | 412 ms | 398–431 ms | 8    |
| branch `def5678` | 287 ms | 279–301 ms | 8    |

Median ratio: 0.70×.

</details>
```

## Diagrams

Give the reviewer the shape of the change:

1. A **before** structure diagram (flowchart or class diagram) of the
   modules, stores, or data flow the diff touches.
2. An **after** diagram of the same region, with the same node names for
   whatever stayed, so the difference is what changed.
3. A **sequence diagram** of the key path: the call or event sequence the
   change speeds up or reroutes.

Use real symbol names from the code at the stated SHAs. Render every block
before posting with `npx -y @mermaid-js/mermaid-cli -q -i diagram.mmd -o diagram.svg`,
which exits non-zero on a syntax error; a block that fails to render in
GitHub shows as raw text.

Put each diagram in its own `<details>` block, with before and after in one
block when they are short enough to compare in one view.
