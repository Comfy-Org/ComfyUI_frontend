# ADR-AGENT-CONTEXT-0028: Separate Workflow References from Editor Tabs

Date: 2026-09-07

## Status

Proposed

## Context

A conversation's editable workflow, the user's visible editor tab, and the
workflows explicitly attached to a prompt can differ. Replacing `open_tabs`
with a curated context list changes an existing snapshot contract used by the
backend tab registry and legacy clients. Deriving references from that snapshot
also records workflows the user never selected as prompt attachments.

## Decision

Keep `open_tabs` as the automatic editor snapshot. Send explicit per-turn
`workflow_references` independently and use `workflow_id` for the pinned editable
target. Modern panel requests omit the legacy `current_tab` fallback.

An omitted reference field preserves legacy model context. A present empty array
means no additional workflow context; modern clients always send an array. The
backend authorizes references separately and persists only explicit references.
Unavailable references retain their client-supplied IDs/names with an unavailable
marker so the Agent can acknowledge missing context. This does not grant access
or reveal workflow contents; saved history retains the same reference intent.

Inline references are represented in message `content` as
`[name](workflow://encoded-id)` links, preserving sentence order and identifying
workflows with matching names. The frontend restores these links as chips only
when their IDs appear in the persisted reference metadata. The links are prose;
`workflow_references` still owns context selection and authorization. Older
messages without inline links keep their text and normalize references to
position zero on ingestion. Drafts and transcripts require positioned references;
workflow discovery returns metadata, and the editor assigns its insertion
position. Sending an edited legacy prompt uses these same explicit positions.

We considered marking individual open tabs as selected. A separate field keeps
view state and prompt intent independently owned and permits referencing a saved
workflow without requiring it to remain open. Renaming or repurposing `open_tabs`
was rejected because it would change existing consumers' meaning.

## Consequences

### Positive

- Viewing or opening a workflow does not attach it to a modern Agent prompt.
- Legacy tab registry and target-resolution behavior retain their contracts.
- Reference chips and restored history describe explicit prompt selections.

### Negative

- Backend support must deploy before clients send the new request field.
- Omission and empty arrays have distinct semantics that both engines must retain.
- This context contract does not replace backend edit authorization or tool gates.

## Notes

[FE-1939](https://linear.app/comfyorg/issue/FE-1939) coordinates this change with
[Cloud #8529](https://github.com/Comfy-Org/cloud/pull/8529). Cloud OpenAPI and the
Agent turn schema own the wire contract; the ingest type package is generated.
