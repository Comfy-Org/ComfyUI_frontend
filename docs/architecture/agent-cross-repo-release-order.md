# Agent cross-repository release order

Agent protocol and applier changes must move in this order:

```text
frontend workspace source merge + immutable comfy-multi-player release
  -> cloud pin + tests + dark deploy + runtime proof
  -> same frontend revision + tests + flag-off deploy
  -> flags on + authenticated browser canvas/reconnect proof
  -> stable promotion of the exact tested combination
```

The frontend consumes `packages/comfy-multi-player/src/index.ts` through the pnpm workspace, so a
frontend merge is also the package source merge. Tag that exact frontend commit as
`comfy-multi-player-v<version>` and publish its immutable npm artifact before updating the cloud
consumer's exact version. Run package-source/parity checks, unit and browser tests, and prove both
product-flag states before widening exposure.

Deploy the frontend with user exposure off. The integration receipt names exact frontend/cloud
revisions, the shared package version, and flag values. `agent-in-app-experience` is the
product/cohort flag; `AGENT_CRDT_MODE` plus `workflows.crdt_enabled` selects the V1 storage path.
They are not interchangeable.

Acceptance requires an authenticated browser flow that causes a visible canvas edit and survives
reconnect. Package CI, frame tests, healthy services, or a served frontend alone do not satisfy the
gate. Stable promotion reuses the exact integrated combination, makes the backend compatible first,
verifies the served frontend revision, and expands product access last.

Backward-compatible frontend-only changes that do not emit, require, or expose a backend contract
may merge independently if the PR explains why. Documentation-only changes may proceed in parallel.

## Glossary

- **Dark deploy:** compatible code deployed while user exposure is disabled.
- **Integrated receipt:** exact revisions, package version, flags, and browser-visible proof.
- **Consumer pin:** the exact shared-package version recorded in the manifest and lockfile.
- **Workspace source:** the canonical package TypeScript imported directly by frontend Vite.
