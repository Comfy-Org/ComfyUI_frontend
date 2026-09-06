# ADR-001: Applier is a single shared package, no second implementation

**Status:** Accepted
**Date:** 2026-08-20
**Invariant:** FC-3

## Context

The browser and cloud workflow host both need to fold semantic operations into the same Yjs document and project the same workflow JSON. Separate implementations can drift in validation, ordering, defaults, and projection while appearing locally correct.

The deployed cloud architecture runs this TypeScript package in a stateless Node doc-host sidecar. The browser imports the same package. There is no Go applier.

## Decision

`@comfyorg/comfy-multi-player` is the one implementation of op-to-document semantics.

- Browser and Node host consume the same package pinned by immutable git SHA.
- Do not add op-to-document logic in Go or another language.
- Keep applier, projection, and mint pure and portable, with `yjs` as the only runtime dependency.
- If a second implementation is ever unavoidable, record an invariant exception first and require shared golden-vector parity before use.

## Consequences

- Semantic behavior cannot drift between browser and host through independent fixes.
- Portability constraints are load-bearing and reviewed under KA-3 / FC-3.
- The doc host pays a sidecar boundary cost rather than duplicating the applier in Go.
- Repository placement may change later without changing the package import path or creating another implementation.

## Alternatives considered

- **Native Go applier:** rejected because it creates a second semantic authority and violates FC-3.
- **Frontend-only applier:** rejected because the headless host must apply operations without a browser.
