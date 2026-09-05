# ADR-DEVEX-MONOREPO-0028: Comfy Multi-Player Is a Frontend Workspace Package

Date: 2026-09-02

## Status

Accepted

## Context

The in-app agent frontend and Node document host share
`@comfyorg/comfy-multi-player` as the only semantic-operation-to-Yjs-document
applier. Developing the package in a separate repository required a manual
`pnpm link` loop for frontend work. That loop made Vite resolution and hot
module replacement depend on local machine state and left two repositories
that could appear to own the implementation.

The package already has independent release history and a published npm
identity that the Node consumer must continue to pin exactly.

## Decision

Move the complete package history into
`packages/comfy-multi-player` and make that directory the only writable source
of truth.

- The frontend depends on `@comfyorg/comfy-multi-player` with `workspace:*`.
  The package's development exports point to `src/index.ts`, so Vite transforms
  and watches source directly without `pnpm link` or a package build.
- Published artifacts keep the existing package name and versioning. The
  package `publishConfig` rewrites exports to `dist/index.js` and
  `dist/index.d.ts`; source files are not published.
- `workspace:*` replaces the SHA pin for the frontend only.
  [ADR-CRDT-FOLLOWER-0025](CRDT-FOLLOWER-0025-in-app-agent-crdt-follower-and-distribution-resolved-boundaries.md) required the applier
  to be pinned by SHA, which addressed a package resolved from another repository. That
  clause is amended there rather than left to contradict this one. Every consumer
  outside this repository, including the cloud `services/agent/dochost` sidecar, still
  pins the published version exactly. That exact pin prevents an unintended version
  change; it does not by itself prevent drift, because workspace source can advance
  ahead of the last published artifact. The two repositories are held on the same
  applier bytes by the release order instead: the external pin advances only after the
  matching frontend commit is tagged `comfy-multi-player-v<version>`, published, and
  tested, per
  [`agent-cross-repo-release-order.md`](../architecture/agent-cross-repo-release-order.md).
- Releases are cut from namespaced `comfy-multi-player-v*` tags in this
  repository. Package-specific CI, mutation testing, and publishing remain
  independently scoped to the package boundary.
- The standalone repository becomes a historical, read-only pointer to this
  directory. New implementation changes are not accepted there.
- Package history is joined to the frontend repository with a two-parent
  import commit, preserving original authorship, dates, and commit messages.

```text
packages/comfy-multi-player/src ──workspace:*──▶ frontend Vite
                │                                  │
                │ direct source transform/watch   └── HMR
                ▼
          build + pack
                │
                ▼
@comfyorg/comfy-multi-player@exact ────────────▶ Node doc host
```

## Consequences

Frontend package changes and their consumer adaptation can be reviewed in one
PR and exercised by one lockfile. The Node consumer still receives immutable
npm releases and must update its exact pin only after the corresponding
frontend commit is tagged and published. The repository-level format and lint
tools exclude this imported package because its stricter package-local gates
remain authoritative.

The standalone repository and its old `v*` releases remain available for
historical provenance, but only this workspace accepts future source changes.

## Glossary

- **Document host:** Node service that owns and mutates the shared Yjs document.
- **HMR:** Hot module replacement; Vite updates changed modules without a full reload.
- **Namespaced tag:** Package-specific Git tag such as `comfy-multi-player-v0.2.2`.
- **Workspace source:** Canonical TypeScript imported directly from another pnpm workspace package.
