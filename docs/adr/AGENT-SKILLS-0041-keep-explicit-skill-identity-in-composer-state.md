# ADR-AGENT-SKILLS-0041: Keep Explicit Skill Identity in Composer State

Date: 2026-10-06

## Status

Proposed

## Context

Slash selection needs a stable identity through editing, Undo and remount, while
ordinary typed slash text and historical raw slash text remain ordinary text. Skills also
coexist with workflow, node and asset references. The saved user skill
catalog already belongs to Settings; a second catalog would diverge after CRUD
or an account change. The existing message endpoint supports named-skill requests
through ordinary content. Backend turn context advertises saved names and
descriptions; `list_skills` and `load_skill` resolve the requested skill by name
only.

## Decision

Keep one positioned, scope-bound skill reference in the existing composer
store. Render its name as underlined inline text with shared description hover
content, while retaining an atomic editor node. Replacement is one undoable
transaction and preserves existing attachment ownership and workflow targeting.
Internal snapshots retain placement and relative workflow order, including
adjacent tokens with identical text offsets. Display metadata contains no body.
References store the skill's name and original description, not a catalog ID.
Identity and availability are by name, matching backend `load_skill`. A
reference is available when a confirmed current-scope catalog contains its name,
unavailable when that catalog lacks it, and shown normally without a claim
otherwise; a renamed skill is unavailable, and a same-name recreation is
available again. Clipboard serialization emits readable `/name` text with the
name and display description. A complete pasted `/name` command at the text start
or after whitespace, like a typed one, and valid rich skill references express
selection intent, rebound to the receiving scope
and constrained to one skill; metadata grants no runtime authority. Plain paste
takes the catalog description for its name, resolving an unresolved plain paste
only after a confirmed current-scope listing without adding an Undo step or
user-input revision. Rich-pasted and historical descriptions remain original
snapshots, including while checking or unavailable. Clipboard parsing uses the
saved-pack name and description limits.

Use the existing Settings skill catalog store for lazy composer discovery,
concurrent request deduplication and CRUD updates. Catalog scope includes the
backend, resolved user and workspace. Scope changes clear cached data and old
selection; asynchronous completions cannot update another scope.
Opening the slash picker shows cached matches and refreshes this same catalog,
because Agent-created skills can bypass frontend CRUD notifications. Filtering
does not refresh. Catalog replacement preserves the highlighted skill by name
when present, otherwise highlights the first remaining match.

Serialize the selected skill in one format, an explicit Markdown link in ordinary
message content: `[Use the saved skill /name](skill://name?description=<encoded>)`.
The destination carries only the reference's own canonical name and encoded
original display description. Submission does not substitute a renamed current
name or add availability wording. This is a frontend persistence format, not a
new backend field or tool protocol. Restore it into display metadata in live and
persisted user messages, preserving workflow ordering. The parser also accepts
and ignores one trailing legacy `&id=<value>` parameter, which early development
messages carried. Plain typed `/name`, historical raw slash text and other link
variants remain ordinary text. An unavailable catalog or a confirmed-missing
skill does not erase the requested name or block Send; the backend owns runtime
resolution. Availability is never stored in Undo/history. Failed sends restore
the untouched semantic draft through the existing submission owner.

Alternatives considered:

- Parse ordinary typed `/name` on send: conflates text with explicit selection.
- Bind references to catalog IDs: contradicts runtime behavior, because
  `load_skill` resolves by name, so a renamed skill would look available but
  fail to load.
- Require a new selected-skill API and enforced preload: provides a stronger
  guarantee, but is outside this feature's approved message-based behavior.
- Store a second catalog in the composer: duplicates Settings authority and
  requires another invalidation and CRUD synchronization mechanism.
- Render a chip: conflicts with the intended inline presentation. Atomic
  editing does not require chip styling.
- Send instruction bodies: moves runtime skill ownership into the frontend and
  cannot establish validation or pinning across turn recovery.

## Consequences

### Positive

- Selection identity survives editor history and remains distinct from readable
  text.
- The message-content format restores inline presentation when editing history
  without sending instruction bodies or modifying generated API types.
- Availability matches what the backend can actually load by name.

### Negative

- Shared catalog loading needs generation and scope guards, and snapshots need
  cross-kind ordering metadata.
- Named-skill invocation remains model-mediated: selection expresses the user's
  request without guaranteeing a `load_skill` call.
- A deleted skill recreated under the same name is treated as the same skill.
