# ADR-WORKSHOP-VALIDATION-0036: Declarative input constraints

Date: 2026-09-22

## Status

Proposed

## Context

Models share provider endpoints but expose different input combinations.
Scalar validation alone allowed incompatible combinations through the form;
some were rejected during request preparation and others by the provider.
Rules need to run before uploads, identify the affected input, and remain
available to both the browser form and request preparation.

## Decision

Keep scalar limits in the existing JSON Schema. A field may additionally
declare a `formConstraint` with a JSON Schema evaluated against the whole
form and an error code assigned to that field. Empty strings, absent values,
and empty file lists are omitted for presence checks; zero and false remain.

Use the existing validator rather than per-model validation callbacks or a
second expression language. Request callbacks continue composing payloads.

Media properties require browser effects: a shared, cancellable metadata
reader measures video duration before uploads. Each model declares its
`maxVideoDurationSeconds`; model-specific JavaScript is unnecessary.
Metadata that cannot be read produces an actionable input error, with the
sanitized exception retained by the existing reporting path.

Diagnostics include only error field names found in the authored form;
provider-supplied field names and user input values are not forwarded.

## Consequences

### Positive

- Numeric limits and relationships between inputs are reviewable data.
- The form and request preparation enforce the same synchronous rules.
- Media checks share cancellation and cleanup instead of duplicating them
  per model.

### Negative

- Provider limits must still be maintained and enforced on the server.
- Browser video checks depend on supported codecs and reachable media;
  unreadable metadata requires a playable source or accessible link.
- Whole-form constraints need field-level regression tests because the
  provider schema does not describe every mode restriction.
