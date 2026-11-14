# ADR-WORKFLOW-PERSISTENCE-0056: Warn on unload when workflow recovery is uncertain

Date: 2026-11-12

## Status

Proposed

## Context

An unsaved workflow can have a recoverable browser draft. Warning on every
unsaved change teaches users to dismiss the warning even when recovery fails.
Enabling persistence alone does not establish recovery because storage can
reject writes and drafts can disappear or fall behind current edits.

## Decision

Keep explicit saves separate from draft recovery. Before allowing an unload
without a warning, checkpoint the active workflow and verify persisted recovery
data for every modified workflow. Include the tab records needed to reopen the
workflows after refresh or browser restart. Treat an uncertain result as unsafe.

Perform the checkpoint synchronously before deciding whether to prevent unload.
Browser unload cannot wait for an asynchronous save, and a later lifecycle event
cannot cancel the navigation. Preserve the user's warning preference and the
explicit bypass for a reload the user already confirmed.

Verify inactive drafts without rewriting them. Another browser tab may have
changed the same draft, and a verification failure must not silently replace
that tab's work. Recovery checks do not clear the unsaved state.

## Alternatives considered

- Trust the persistence setting or a previous successful write. Rejected because
  neither proves that current edits remain available to startup.
- Remove the warning entirely. Rejected because persistence can be disabled or
  unavailable.
- Save the workflow file during unload. Rejected because an unload cannot await
  the request and draft recovery must not imply an explicit save.

## Consequences

The check establishes recovery at the time of the checkpoint. It cannot prevent
later browser storage eviction, remote file changes, or another browser tab
overwriting shared recovery records. Independent recovery for concurrent browser
tabs requires a separate change to persistence ownership.
