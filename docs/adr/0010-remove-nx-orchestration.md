# 10. Remove Nx Orchestration

Date: 2026-05-19

## Status

Accepted

<!-- [Proposed | Accepted | Rejected | Deprecated | Superseded by [ADR-NNNN](NNNN-title.md)] -->

## Context

[ADR-0002](0002-monorepo-conversion.md) adopted [Nx](https://nx.dev/) as a tooling option for managing the
ComfyUI Frontend monorepo on top of pnpm workspaces. Nx was introduced as task
orchestration to coordinate builds, tests, lints, and types across the apps and
packages workspaces.

In practice, Nx provided little value beyond what pnpm workspaces and the
underlying native tool CLIs (Vite, Vitest, Playwright, ESLint, oxlint, oxfmt,
TypeScript) already offer:

- pnpm's `--filter` and `--recursive` flags already provide topological,
  parallel, and selective execution across workspaces.
- Each underlying tool already has fast, well-supported caching (Vite, Vitest,
  ESLint, oxlint, TS incremental builds, etc.).
- Nx added an extra configuration surface (`nx.json`, `.nxignore`, per-package
  `nx` blocks), an extra cache layer, an extra `node_modules/.cache/nx`
  artifact, and an extra CI dimension to debug.
- Contributors and AI agents had to learn the Nx mental model in addition to
  pnpm and the individual tool CLIs.
- The Nx daemon and remote-cache features were not in use, so the runtime
  benefit was limited to local task graph caching, which is largely redundant
  with the per-tool caches.

The cost (configuration, mental overhead, surprise behavior, occasional
cache-related failures) exceeded the benefit.

## Decision

Remove Nx from the repository and run monorepo tasks using:

- pnpm workspace scripts (`pnpm -r run <script>`,
  `pnpm --filter <pkg> run <script>`).
- Each tool's native CLI (Vite, Vitest, Playwright, ESLint, oxlint, oxfmt,
  `vue-tsc`, etc.) invoked directly from the relevant workspace.

Concretely, this change:

- Deletes `nx.json` and `.nxignore`.
- Removes `nx` entries from root and per-package `package.json` files (the
  `nx` block on each `package.json`, the dev dependency, and Nx-specific
  scripts).
- Removes `nx`-related entries from `pnpm-workspace.yaml`'s `allowBuilds`.
- Rewrites the affected CI workflows (`.github/workflows/ci-tests-e2e.yaml`,
  `.github/workflows/release-draft-create.yaml`) to call pnpm/native CLIs
  directly.
- Updates `AGENTS.md`, `TROUBLESHOOTING.md`, and
  [ADR-0002](0002-monorepo-conversion.md) to reflect the new tooling story.
- Cleans up Nx-specific lint/format/ignore rules in `.oxlintrc.json`,
  `eslint.config.ts`, `vite.config.mts`, and `.gitignore`.

## Consequences

### Positive

- Fewer moving parts: no `nx.json`, no `.nx/` cache, no Nx daemon, no
  Nx-specific scripts to maintain.
- Easier onboarding for contributors and AI agents: pnpm + each tool's CLI is
  the only required knowledge.
- CI logs and failures are easier to read because tasks run directly under the
  tool that owns them, instead of being wrapped by Nx.
- Faster, more predictable cache invalidation behavior — each tool owns its
  own cache and we no longer hit Nx-cache edge cases.
- Smaller dependency tree (~2k fewer lines in `pnpm-lock.yaml`).

### Negative

- We lose Nx's unified task graph and project graph commands; coordination
  across workspaces now relies on pnpm filters and explicit script wiring.
- We lose Nx's remote/distributed caching as a future option without
  re-adopting Nx (or a comparable tool like Turborepo).
- Contributors who already knew Nx workflows need to relearn the equivalent
  pnpm invocations.

## Notes

- The migration is purely a tooling change; no application behavior, public
  API, or build output changes.
- If we later need more sophisticated task orchestration (e.g. distributed
  remote cache, fine-grained affected-graph queries), revisit this decision and
  evaluate Nx, Turborepo, or Moon at that time, with concrete CI/perf data to
  justify the additional complexity.
