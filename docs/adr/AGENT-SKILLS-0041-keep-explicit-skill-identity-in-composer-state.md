# ADR-AGENT-SKILLS-0041: Keep Explicit Skill Identity in Composer State

Date: 2026-10-06

## Status

Proposed

## Context

Slash selection needs a stable identity through editing, Undo and remount, while
ordinary slash text and pasted content must remain ordinary text. Skills also
coexist with workflow, node and asset references. The saved user skill
catalog already belongs to Settings; a second catalog would diverge after CRUD
or an account change. The existing message endpoint supports named-skill requests
through ordinary content. Backend turn context advertises saved names and
descriptions; `list_skills` and `load_skill` resolve the requested skill.

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

Serialize the selected name as an explicit “Use the saved skill /name” Markdown
link in ordinary message content. Its `skill://` destination carries only the
canonical name and encoded display description. This is a frontend persistence
format, not a new backend field or tool protocol. Restore it into display
metadata in live and persisted user messages, preserving workflow ordering.
Plain `/name` text and clipboard content do not create selected identity.
An unavailable catalog does not erase the requested name or block Send; the
backend owns runtime resolution. Failed sends restore the untouched semantic
draft through the existing submission owner.

## Alternatives considered

- Parse `/name` on send or paste: conflates typed text with explicit selection.
- Require a new selected-skill API and enforced preload: provides a stronger
  guarantee, but is outside this feature's approved message-based behavior.
- Store a second catalog in the composer: duplicates Settings authority and
  requires another invalidation and CRUD synchronization mechanism.
- Render a chip: conflicts with the intended inline presentation. Atomic
  editing does not require chip styling.
- Send instruction bodies: moves runtime skill ownership into the frontend and
  cannot establish validation or pinning across turn recovery.

## Consequences

Selection identity survives editor history and remains distinct from readable
text. Shared catalog loading needs generation and scope guards, and snapshots
need cross-kind ordering metadata. Named-skill invocation remains model-mediated:
selection expresses the user's request, without guaranteeing a `load_skill`
call. The message-content format also restores inline presentation when editing
history without sending instruction bodies or modifying generated API types.
