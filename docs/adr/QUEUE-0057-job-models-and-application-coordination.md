# ADR-QUEUE-0057: Job models and application coordination

Date: 2026-11-14

## Status

Proposed

## Context

Jobs are consumed by queue history, assets, workflow restoration, and live execution views. Their immutable representation was coupled to application stores through output loading and workflow restoration methods. Moving that class unchanged into a package would reverse the dependency between the API client and the application.

Queue submission also contains extension contracts that are independent of the visible queue panel. Consolidating only presentation would leave submission, recovery, and legacy scheduling outside queue ownership.

## Decision

The API client owns job schemas, fetching, embedded workflow extraction, and immutable task projection. Shared output parsing belongs to the API contract rather than exclusively to jobs. Authenticated media URLs remain application policy.

The application queue domain owns connected presentation, queue stores, output caching, scheduling, recovery, submission, and command and settings contributions. Other domains import declared queue entry points directly. A domain-wide barrel would make small consumers depend on unrelated runtime initialization.

Output loading constructs immutable tasks from fetched details. Workflow restoration is an application action because it mutates the editor and notifies extensions. Neither operation belongs on the package task class.

Submission state belongs to each application instance. Keep the extension-facing queuePrompt overloads, pending-request LIFO order, concurrent enqueue-then-false result, per-batch widget hooks, captured workflow metadata, and completed batch count. This restructuring does not add automatic submission retries because the server provides no idempotency guarantee.

Legacy and modern auto-queue remain separate policies in one owner. Their transitions and controls differ. Combining them through configurable callbacks would conceal those differences rather than remove duplication. Their listeners follow the lifetime of the host that installs them.

The action bar retains drag, docking, deployment, and quota responsibilities. Queue controls compose within that shell. Authentication and subscription wrappers retain their respective owners. Execution event routing, asset history pagination, and media inspection remain separate capabilities.

## Alternatives considered

- Create a new queue package for stores and UI. Those modules depend on application services and would require a second dependency-injection framework without providing an independent consumer.
- Put initialization state, estimates, and display contracts in the API client. These are application presentation policy, not backend job contracts.
- Merge every output reader. Asset deletion requires complete pagination, while preview readers accept partial results. Sharing the latter contract would make deletion unsafe.
- Replace the submission method with generic host callbacks. The existing application contract already describes its collaborators. A second interface would add indirection without separating a reusable implementation.
- Collapse legacy scheduling into the modern scheduler. That changes behavior and is not necessary to establish ownership.

## Consequences

Package code cannot import application code. Queue application internals are protected by declared public entry points and import-cycle checks. The transport singleton and legacy extension import shims remain unchanged.

The queue domain still coordinates editor, auth, billing, execution, and asset services. Colocation does not remove those legitimate dependencies or make them queue-owned. Changing their contracts requires separate behavior changes.
