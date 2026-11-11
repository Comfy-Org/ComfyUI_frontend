# ADR-ASSETS-BOUNDARY-0045: Portable asset data and application integration

Date: 2026-11-11

## Status

Accepted

## Context

Asset browsing, widget choices, missing-resource validation, and agent attachments
consume the same normalized asset data. Their shared data operations previously
imported application implementation modules. Moving all asset code into a package
would also move authenticated transport, Vue state, and editor commands into that
dependency chain.

Grouped output cards introduce a second constraint. Their display identity can be
a job ID, while downloads and record deletion require the underlying asset ID.
Storage identity can also survive enrichment outside the serialized display data.
Treating those identities as interchangeable changes which content an action uses.

## Decision

Keep normalized contracts and deterministic asset data operations in a private
workspace package. The package has no dependency on application code, framework
state, editor classes, authenticated transport, or browser objects. Consumers use
explicit package entry points.

Keep asset state, transport, presentation, and editor adapters together in the
application assets domain. External callers use characterized entry points rather
than internal modules. Generic file handling, model-provider registration,
LiteGraph rendering, execution history, and workspace authority retain their
existing owners.

Keep grouped-output projection and identity resolution in application adapters.
Actions resolve record and storage identity before issuing content or deletion
requests. Data extraction must preserve stored identity and must not JSON-clone
these projections.

## Alternatives

- Moving all asset behavior into a package would couple reusable contracts to
  application singletons and editor lifecycle.
- Keeping everything in the application would retain implementation imports for
  consumers that need only schemas or deterministic data operations.
- A shared barrel would reduce import-path variety but could eagerly load dialogs
  or join registration and presentation into an import cycle.

## Consequences

Package declarations and tests can run without an initialized application.
Application adapters retain distribution, authentication, and lifecycle policy.
This changes ownership and dependency direction, not asset lifecycle behavior or
the extension-facing widget contract.
