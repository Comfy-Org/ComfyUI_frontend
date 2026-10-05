# ADR-AGENT-COMPOSER-0040: Independent Assets and Prompt References

Date: 2026-10-05

## Status

Proposed

## Context

An asset added to the agent composer must be sent even without an inline
mention. Users may mention one asset repeatedly, delete or undo an occurrence,
and continue typing while an upload or send completes. Deriving attachments
from prompt references makes deletion remove the asset from the request and
makes repeated mentions duplicate it.

## Decision

The existing composer store owns the ordered included asset IDs and asset
metadata. Prompt references identify occurrences at text positions. Adding an
asset stages it; mentioning an included asset inserts an occurrence. Editor
history may restore occurrences only for assets still included in the tray.
Removing a tray item retires its identity and removes every occurrence; an
explicit new drop gets a fresh identity.

Send snapshots retain both the included assets and the prompt. An untouched
failed draft restores both; newer user input wins. Local preview resources
remain owned by the store while included or held by a pending snapshot, and are
released when no longer retained. UI hover/focus highlighting and native scroll
measurements remain local to components and never change the draft.

## Alternatives considered

- Continue deriving attachments from references: cannot express an unmentioned
  included asset or repeated references without changing send semantics.
- Keep a separate tray in a component: loses assets across remount and makes
  upload completion, Undo and failed-send recovery depend on mounted UI.
- Create another persistent asset store: duplicates the existing composer's
  submission lifecycle without a separate sharing requirement.

## Consequences

Attachment metadata is resolved through one owner when applying editor history.
Removing an inline occurrence keeps the included file. Send payloads contain
one entry per included asset while preserving every inline mention. Callers
stage and reference assets through distinct store commands.
