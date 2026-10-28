# ADR-BOOTSTRAP-0044: Initialization contracts

Date: 2026-10-13

## Status

Proposed

## Context

FE-3388 expands `comfy/no-new-error-throw` to every throw statement. Two
registration accessors used `assert` to narrow optional state. That assertion
returns in production, so the accessors could return `undefined` despite
their nonoptional signatures.

`useApp` breaks an import cycle. Its consumers are dependencies of
`scripts/app.ts`, which registers the singleton immediately after construction.
An unregistered read during module evaluation must stop startup. After that
module evaluates, registration is permanent. Extensions load after registration.

The extension dialog registry has a different owner. `App.vue` creates both
the composed dialog service and the extension manager. The registry adds an
uninitialized state between two operations in the same setup function.

## Decision

Retain one statement-scoped exception for `useApp` in `appRegistry.ts`.
Its throw rejects the import of `main` during boot. `bootstrap.ts` catches
that rejection and calls `reportError` with `failure_initializing_app`.
Dependent module initialization stops. This exception does not authorize
throws for runtime refusals or extension callbacks.

Compose the dialog service directly onto the workspace store before assigning
`app.extensionManager`. Keep the store's identity and reactive properties so
extensions retain the existing manager contract. Remove the dialog registry.

## Alternatives

- Optional `useApp` results would require refusal branches throughout canvas,
  workflow, and extension operations for a boot-order failure. Silent skips
  would leave startup bugs unresolved, and extensions still require an app.
- Constructing the app from the registry would reintroduce the import cycle.
- Using `assert` preserves the incorrect production type contract.
- Keeping the dialog registry with another throw retains an unnecessary
  failure state where the composition owner can provide the dependency.

## Verification and limits

Registry tests exercise unregistered access with `DEV` both true and false.
The bootstrap regression verifies that the handler reports the failure and
that initialization after the accessor does not run. Browser tests exercise
the composed dialog through the public extension API and assert its rendered
message without importing stores across domain boundaries.

Early startup reporting may precede telemetry initialization. `reportError`
logs immediately and queues remote delivery. Remote delivery requires an
initialized sink, so an early startup failure may leave reports queued.
This change does not add a startup retry UI.
