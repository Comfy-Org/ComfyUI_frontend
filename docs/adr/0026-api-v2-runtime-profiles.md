# 26. API V2 Runtime Profiles

Date: 2026-08-31

## Status

Proposed

## Context

API V2 custom-node packs need to run in both open-source ComfyUI and hosted or
locally enabled secure environments. Maintaining separate public APIs or
separate pack formats would make converted packs platform-specific and cause
the implementations to drift.

The two environments do not have the same trust model. A normal local user may
choose to run legacy V1 custom nodes in process. Secure execution must never
silently fall back to that path when its sandbox host is missing, rejects a
module, or fails during startup.

## Decision

ComfyUI exposes one API V2 authoring contract and one V2 pack format with two
mutually distinct runtime profiles.

### Normal local profile

- V1 custom nodes and API V2 custom nodes may coexist.
- Existing V1 discovery and in-process loading remain available, subject to
  the existing command-line controls and allowlists.
- API V2 Python operations use the standard in-process providers.
- API V2 frontend extensions load directly in the main document unless a
  selective extension host has been installed explicitly.

### Secure profile

- Core ComfyUI nodes remain trusted and available.
- Third-party nodes must be manifest-backed API V2 nodes.
- V1 custom-node discovery and execution are disabled, including allowlisted
  V1 loading.
- API V2 Python operations use providers installed by the configured secure
  overlay.
- The overlay advertises an exclusive frontend extension host through the
  backend feature response. Every third-party frontend extension is routed to
  that host.
- A configured overlay or exclusive extension host that cannot initialize is
  a startup error. Secure mode never falls back to local execution.

The backend owns profile selection. The frontend consumes a generic extension
host declaration and does not contain product-specific secure-mode branching.
Pack code continues to import the same public API and retain the same node IDs,
schemas, and workflow representation in both profiles.

## Consequences

- Pack authors and conversion tools produce one artifact for local and secure
  execution.
- Most implementation code and conformance tests are shared.
- Local users retain compatibility with the V1 ecosystem while adopting V2
  incrementally.
- Secure deployments have an auditable, fail-closed boundary with no legacy or
  direct third-party execution path.
- Provider implementations and process isolation remain platform concerns;
  they are not encoded in pack source.
- A secure overlay version must remain compatible with the public provider and
  extension-host interfaces exposed by its paired backend and frontend.

## Verification

Release tests must cover both profiles explicitly:

- local startup with V1 loading enabled and disabled;
- local API V2 execution without an overlay;
- secure startup suppressing V1 loading regardless of local flags;
- configured overlay failure aborting startup;
- absent frontend host configuration preserving direct loading;
- secure host configuration requiring an exclusive provider; and
- exclusive provider failure never falling back to direct module import.
