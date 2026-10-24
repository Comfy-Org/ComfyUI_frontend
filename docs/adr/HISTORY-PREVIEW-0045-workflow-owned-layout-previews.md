# ADR-HISTORY-PREVIEW-0045: Workflow-owned layout previews

Date: 2026-10-22

## Status

Proposed

## Context

Gap dragging updates live node geometry before the user releases the pointer.
Keyboard listeners and delayed history captures also read that geometry.
Skipping a capture in the drag handler alone cannot keep previews out of undo
history. Component teardown can occur after the outgoing workflow was saved.

## Decision

The workflow history tracker owns one interruptible preview at a time. Its
owner supplies the interruption behavior. History capture and delayed baseline
updates wait until the owner settles the preview. Workflow deactivation and
undo or redo interrupt the preview before reading or replacing graph state.

An unfinished pointer drag cancels on graph navigation. Cancellation restores
raw positions of the original node instances, even when their drawn bounds
changed. Completed keyboard nudges and slider edits commit on interruption.

## Alternatives

Reusing the ordinary before-change and after-change counter would suppress
captures, but would not provide a way to settle the gesture before workflow
deactivation. Storing a preview separately from live layout would avoid that
suppression, but would require a second geometry source for nodes and links.

## Consequences

Preview owners must release their preview after either commit or rollback.
Navigation cannot leave a half-finished gap drag in the outgoing workflow.
This does not make unrelated graph operations rollback transactions.
