# ADR-WEBSITE-REQUESTS-0030: Creator widgets and Router request composition

Date: 2026-09-09

## Status

Proposed — implemented in the local Models preview following product direction;
not a claim of completed team architecture review or production rollout.

## Context

Router schemas describe wire bodies, not a creator interface. Nested media,
dialogue and generation settings produced 151 raw JSON controls on 78 Models
pages. Asking users to assemble JSON or Base64 makes those inputs unusable.
The native schema must remain authoritative while the UI presents ordinary,
curated fields. Run and copyable examples must describe the same request.

## Decision

Keep native schemas and add a generated creator definition alongside each
affected contract. Curated controls supply labels, concise inline help, defaults,
visibility and Standard/Advanced placement. Explicit model-family selections
and shared input definitions are source data; compiler helpers pack the result
one model per line. Components remain generic.

Request composition has exactly two alternatives:

- A literal JSON template containing `$repl_type("input_id", extra)` tokens in
  complete value positions. The allowlisted replacements serialize typed values
  once. They do not evaluate expressions, branch, loop, omit fields, replace
  keys or rescan inserted user content. Unsupported extra arguments fail closed.
- A named, statically registered TypeScript callback when logic is needed.
  Conditional media insertion, arrays, modes and nested settings belong here,
  never in an expanding template language. Callbacks do not perform network I/O.

Validate creator inputs; preflight real files for MIME/count/size; encode with
cancellation; compose; validate the entire native request; enforce the serialized
size cap. Both Run and API snippets use that boundary. Preserve native schema
restrictions and hidden operational-field restrictions.

Reject the raw-JSON editor as the creator fallback and reject evaluable template
expressions. A missing required scalar stays a minimal widget; a missing usable
structured path requires explicit follow-up, not a fabricated payload. Omit
unsupported optional structures while retaining a useful basic mode.

## Consequences

### Positive

- Ordinary controls support provider-specific JSON without provider Vue pages.
- Inputs remain typed and safely escaped; copied requests match execution.
- Media encoding and conditional request behavior are directly testable.
- Content, Router identity, wire schemas and display names remain separate.

### Negative

- Shared schemas can be broader than a particular provider model. Family
  definitions need evidence and maintenance when those contracts change.
- This is curated feature coverage, not automatic support for every optional
  provider feature. Complex omitted modes need their own controls and tests.
- Local schema validation cannot prove paid provider acceptance or availability.

## Notes

Implementation, supported families, provider references, focused checks and
remaining limitations are in
[Models input presentation](../../apps/website/MODELS_INPUT_SCHEMA.md).
