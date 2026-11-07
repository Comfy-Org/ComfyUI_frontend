# ADR-WORKFLOW-LINKS-0053: Open Saved Workflows by File ID

Date: 2026-11-05

## Status

Proposed

## Context

A Cloud link must keep opening the same saved file after a rename. Folder
links cannot identify one file, and embedding a path makes renames break links.

## Decision

Resolve `savedFile` through an authenticated metadata lookup, then open the
returned path through the existing workflow service. The generated userdata
schema supplies metadata validation; a local UUID extension covers the new
lookup until the generated contract includes it.

Preserve the query through sign-in and onboarding. Defer the lookup while a
deployment or workspace link can reload the page, then resolve it after those
loaders finish. A saved-file link takes precedence over a folder link, even
when the saved file cannot be opened. Final handling clears both intents.

## Alternatives considered

- Extend the folder loader: rejected because sidebar folder filtering and
  authenticated ID lookup have different failure and selection rules.
- Replace path-based workflow state with file IDs: deferred because opening a
  link does not require changing editing, drafts, saves or deletion.

## Consequences

The link resolves the current path at open time. Existing workflow state stays
path based after opening. Missing or invalid IDs leave restored tabs intact.
PostHog records the final result and workspace without the file ID or path.
