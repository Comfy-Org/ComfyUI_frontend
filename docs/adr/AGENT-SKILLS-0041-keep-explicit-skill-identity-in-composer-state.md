# ADR-AGENT-SKILLS-0041: Keep Explicit Skill Identity in Composer State

Date: 2026-10-06

## Status

Proposed

## Context

Slash selection needs a stable identity through editing, Undo and remount, while
ordinary slash text and pasted content must remain ordinary text. Skills also
coexist with workflow, node and asset references. The saved user skill
catalog already belongs to Settings; a second catalog would diverge after CRUD
or an account change. The current message endpoint has no explicit selected
skill contract and cannot guarantee that selection reaches `load_skill`.

## Decision

Keep one positioned, scope-bound skill reference in the existing composer
store. Render its name as underlined inline text with shared description hover
content, while retaining an atomic editor node. Replacement is one undoable
transaction and preserves existing attachment ownership and workflow targeting.
Internal snapshots retain placement and relative workflow order, including
adjacent tokens with identical text offsets. Display metadata contains no body.
Clipboard serialization emits readable `/name` text without selected identity.

Use the existing Settings skill catalog store for lazy composer discovery,
concurrent request deduplication and CRUD updates. Catalog scope includes the
backend, resolved user and workspace. Scope changes clear cached data and old
selection; asynchronous completions cannot update another scope.
Opening the slash picker shows cached matches and refreshes this same catalog,
because Agent-created skills can bypass frontend CRUD notifications. Filtering
does not refresh. Catalog replacement preserves the highlighted skill by name
when present, otherwise highlights the first remaining match.

Selected-skill submission stays blocked until an explicit backend contract is
approved and implemented. Component support for structured restored messages
does not establish a production history transport. No speculative fields are
added to generated API types.

## Alternatives considered

- Parse `/name` on send or paste: conflates typed text with explicit selection
  and leaves runtime consumption dependent on model behavior.
- Store a second catalog in the composer: duplicates Settings authority and
  requires another invalidation and CRUD synchronization mechanism.
- Render a chip: conflicts with the intended inline presentation. Atomic
  editing does not require chip styling.
- Send instruction bodies: moves runtime skill ownership into the frontend and
  cannot establish validation or pinning across turn recovery.

## Consequences

Selection identity survives editor history and remains distinct from readable
text. Shared catalog loading needs generation and scope guards, and snapshots
need cross-kind ordering metadata. This frontend slice is a preview boundary;
selected sending and production restored history require backend integration.
