# Architecture Decision Records

This directory contains Architecture Decision Records (ADRs) for the ComfyUI Frontend project.

## What is an ADR?

An Architecture Decision Record captures an important architectural decision made along with its context and consequences. ADRs help future developers understand why certain decisions were made and provide a historical record of the project's evolution.

## ADR Index

| ADR                                                                                                              | Title                                                           | Status   | Date       |
| ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | -------- | ---------- |
| [AUTH-BILLING-0014](AUTH-BILLING-0014-billing-attempt-context-and-workspace-scope.md)                            | Billing Attempt Context and Workspace Scope                     | Proposed | 2026-07-28 |
| [AUTH-CREDENTIALS-0011](AUTH-CREDENTIALS-0011-cloud-credential-lifecycle-invariants.md)                          | Cloud Credential Lifecycle Invariants                           | Proposed | 2026-07-09 |
| [CRDT-FOLLOWER-0025](CRDT-FOLLOWER-0025-in-app-agent-crdt-follower-and-distribution-resolved-boundaries.md)      | In-App Agent CRDT Follower and Distribution-Resolved Boundaries | Proposed | 2026-08-21 |
| [CRDT-LAYOUT-0003](CRDT-LAYOUT-0003-crdt-layout-intent-and-local-measurement.md)                                 | CRDT Layout Intent and Local Measurement                        | Proposed | 2025-08-27 |
| [CRDT-MINT-0018](CRDT-MINT-0018-merge-identity-for-node-transfers.md)                                            | Merge Identity for Node Transfers                               | Proposed | 2026-08-25 |
| [DEPS-DESIGN-SYSTEM-0004](DEPS-DESIGN-SYSTEM-0004-fork-primevue.md)                                              | Fork PrimeVue                                                   | Rejected | 2025-08-27 |
| [DEPS-LITEGRAPH-0001](DEPS-LITEGRAPH-0001-integrate-litegraph-into-the-frontend.md)                              | Integrate LiteGraph into the Frontend                           | Accepted | 2025-08-05 |
| [DEVEX-BUILD-0010](DEVEX-BUILD-0010-remove-nx-orchestration.md)                                                  | Remove Nx Orchestration                                         | Accepted | 2026-05-19 |
| [DEVEX-LINT-0015](DEVEX-LINT-0015-adopt-fallow-with-new-only-baselines.md)                                       | Adopt Fallow with New-Only Baselines                            | Proposed | 2026-06-29 |
| [DEVEX-MONOREPO-0002](DEVEX-MONOREPO-0002-adopt-a-pnpm-workspace-monorepo.md)                                    | Adopt a pnpm Workspace Monorepo                                 | Accepted | 2025-08-25 |
| [ECS-0008](ECS-0008-entity-component-system.md)                                                                  | Entity Component System                                         | Proposed | 2026-03-23 |
| [ECS-IDENTITY-0016](ECS-IDENTITY-0016-entity-id-collision-policy-and-recovery.md)                                | Entity ID Collision Policy and Recovery                         | Proposed | 2026-08-24 |
| [ECS-SLOTS-0017](ECS-SLOTS-0017-slot-records-as-the-source-of-truth.md)                                          | Slot Records as the Source of Truth                             | Accepted | 2026-08-24 |
| [ECS-WIDGETS-0023](ECS-WIDGETS-0023-widget-entities-with-a-legacy-layer.md)                                      | Widget Entities with a Legacy Layer                             | Proposed | 2026-08-26 |
| [EXTENSIONS-PUBLIC-API-0005](EXTENSIONS-PUBLIC-API-0005-bundle-vue-dependencies-in-extensions.md)                | Bundle Vue Dependencies in Extensions                           | Accepted | 2025-12-13 |
| [GRAPH-DOCUMENT-0024](GRAPH-DOCUMENT-0024-graph-activation-and-document-objects-for-in-app-agent-targets.md)     | Graph Activation and Document Objects for In-App Agent Targets  | Proposed | 2026-08-28 |
| [GRAPH-DOCUMENT-0026](GRAPH-DOCUMENT-0026-frontend-document-model.md)                                            | Frontend Document Model                                         | Proposed | 2026-08-31 |
| [NODE-OUTPUTS-0007](NODE-OUTPUTS-0007-output-passthrough-for-extensible-nodes.md)                                | Output Passthrough for Extensible Nodes                         | Accepted | 2026-03-11 |
| [PERF-BENCHMARKS-0022](PERF-BENCHMARKS-0022-performance-evidence-and-regression-framework.md)                    | Performance Evidence and Regression Framework                   | Proposed | 2026-08-26 |
| [RELEASES-CHANGELOG-0012](RELEASES-CHANGELOG-0012-cloud-release-notes-follow-the-comfyui-version.md)             | Cloud Release Notes Follow the ComfyUI Version                  | Accepted | 2026-07-13 |
| [RENDERING-ATOMICITY-0020](RENDERING-ATOMICITY-0020-frame-atomic-rendering.md)                                   | Frame-Atomic Rendering                                          | Proposed | 2026-08-26 |
| [RENDERING-INVALIDATION-0021](RENDERING-INVALIDATION-0021-classified-frame-coalesced-canvas-invalidation.md)     | Classified, Frame-Coalesced Canvas Invalidation                 | Proposed | 2026-08-26 |
| [SUBGRAPH-PROMOTION-0009](SUBGRAPH-PROMOTION-0009-represent-promoted-widgets-as-linked-inputs.md)                | Represent Promoted Widgets as Linked Inputs                     | Proposed | 2026-05-05 |
| [SUBGRAPH-PROMOTION-0027](SUBGRAPH-PROMOTION-0027-defer-promoted-widget-registration-to-onadded.md)              | Defer Promoted-Widget Registration to `onAdded()`               | Accepted | 2026-09-01 |
| [TELEMETRY-DIAGNOSTICS-0019](TELEMETRY-DIAGNOSTICS-0019-recoverable-event-diagnostics.md)                        | Recoverable Event Diagnostics                                   | Proposed | 2026-08-25 |
| [TELEMETRY-ROUTING-0013](TELEMETRY-ROUTING-0013-telemetry-routing-across-consumers.md)                           | Telemetry Routing Across Consumers                              | Accepted | 2026-07-28 |
| [WIDGET-SERIALIZATION-0006](WIDGET-SERIALIZATION-0006-preserve-primitive-widget-values-across-copy-and-paste.md) | Preserve Primitive Widget Values Across Copy and Paste          | Proposed | 2026-02-22 |

## Creating a New ADR

1. Choose a domain-led identifier composed of one or more uppercase segments and
   the ADR's original four-digit sequence number (for example,
   `CRDT-FOLLOWER-0025`)
2. Name the file `<DOMAIN>[-<SUBDOMAIN>]-<NNNN>-descriptive-title.md`
3. Fill in all sections
4. Update this index
5. Submit as part of your PR

## ADR Template

```markdown
# ADR-IDENTIFIER: Title

Date: YYYY-MM-DD

## Status

[Proposed | Accepted | Rejected | Deprecated | Superseded by [ADR-IDENTIFIER](IDENTIFIER-title.md)]

## Context

Describe the issue that motivated this decision and any context that influences or constrains the decision.

- What is the problem?
- Why does it need to be solved?
- What forces are at play (technical, business, team)?

## Decision

Describe the decision that was made and the key points that led to it.

- What are we going to do?
- How will we do it?
- What alternatives were considered?

## Consequences

### Positive

- What becomes easier or better?
- What opportunities does this create?

### Negative

- What becomes harder or worse?
- What risks are we accepting?
- What technical debt might we incur?

## Notes

Optional section for additional information, references, or clarifications.
```

## ADR Status Values

- **Proposed**: The decision is being discussed
- **Accepted**: The decision has been agreed upon
- **Rejected**: The decision was not accepted
- **Deprecated**: The decision is no longer relevant
- **Superseded**: The decision has been replaced by another ADR

## Further Reading

- [Documenting Architecture Decisions](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions) by Michael Nygard
- [Architecture Decision Records](https://adr.github.io/) - Collection of ADR resources
