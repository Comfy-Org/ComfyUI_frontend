# ADR-WORKFLOW-LINKS-0053: Open Workflow Links Through the Sidebar File

Date: 2026-11-09

## Status

Proposed

## Context

A Cloud link of the form `?workflowId=<workflow id>` names one workflow. Cloud
keeps two copies of a saved workflow: the sidebar file, which the editor opens
and saves, and a workflow record with its own id, copied from that file on each
save. The copy is best effort, so the record can fall behind the file. Folder
links cannot name one file, and a path in the link breaks when the file is
renamed.

## Decision

Ask Cloud for the record's sidebar file with
`GET /api/workflows/{workflow_id}/sidebar-file`. Cloud answers with the file's
path only after it has checked that the file exists, that exactly one record
has that name, and that the file's bytes match the record's newest version.
Open that path through the existing workflow service, so Save writes back to
the same sidebar file.

Fail closed. A 404 or any 409 `WORKFLOW_OUT_OF_SYNC` shows "Couldn't open this
workflow" and opens nothing. The editor never falls back to a folder link or to
the record's own content, and restored tabs stay as they were.

Preserve the query through sign-in and onboarding. Defer the lookup while a
deployment or workspace link can reload the page, then resolve it after those
loaders finish. A workflow-id link takes precedence over a folder link, even
when it cannot be opened. Final handling clears both intents, and only for the
link it handled: a newer link the browser navigated to meanwhile stays in the
URL and the stash for its own run. A workflow that opened stays open when
another navigation cancels that cleanup; the final URL-action sweep clears the
link it left. While the URL or the stash names a newer link, the URL actions
stop before any further replace, so that link's navigation is not cancelled.

The reply is typed in the loader until Cloud's generated types include the
route.

## Alternatives considered

- Open the record's own content: rejected because Save would write to a file
  the record may not match, and an out-of-date copy would open without notice.
- Link by a new id on the sidebar file: rejected because Cloud's existing
  `/api/workflows/{workflow_id}` routes already name a workflow by the record's
  id, and a second id for the same workflow would need its own storage.
- Extend the folder loader: rejected because folder filtering and a single
  checked lookup have different failure and selection rules.

## Consequences

The link resolves the current sidebar path at open time. Workflow state stays
path based after opening. PostHog records the result, the 409 reason and the
workspace, never a workflow name, path or id. A record that has fallen behind
its file cannot be opened from a link until the next save copies it again.
