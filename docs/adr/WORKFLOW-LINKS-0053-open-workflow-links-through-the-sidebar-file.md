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
link it handled. A link the loader has not settled, such as a newer link the
browser navigated to meanwhile, stays in the URL and the stash. Nothing opens
it until the next page load. A workflow that opened stays open when another
navigation cancels that cleanup; the final URL-action sweep clears the link it
left. Only a reload in flight stops the URL actions. A link that is not settled
does not stop them: the other loaders run, and the final sweep removes their
params but leaves `workflowId` and its stash. A navigation guard can hold a
newer link in the stash while the URL still shows the old one. While the URL
and the stash name different links, the loader treats the stash as a navigation
still in flight: it makes no replace and clears neither carrier, even for a
link it already opened. Two different malformed values are different links;
only the forms the stash records for one URL value (a repeated value joined
with `,`, a bare `?workflowId` or an empty `?workflowId=` as `,`) count as the
same link. The router records an empty `?workflowId=` as `,` in place of any
older stashed link rather than clearing the stash: an older link cannot keep
the empty one from being rejected as invalid, and while a guard holds the empty
link, an earlier lookup still sees a newer link in flight and its cleanup
cannot cancel that navigation. While the stash holds a link the loader never
started and the URL does not show, the sweep makes no replace either, so that
link's navigation is not cancelled.

The reply and the 409 body are validated with the generated
`@comfyorg/ingest-types` schemas. The spec types the 409 as `ErrorResponse` and
lists the `details.reason` values only in prose, saying the set may grow. The
loader keeps its list of known reasons as a telemetry classification and
records any other value as `unknown`.

Error reports for the link carry a fixed message, the error type and the
failing error's class name when it is a built-in JavaScript error class, or
`other` for any other name or a name that cannot be read. They never carry the
caught error, its message or a name it chose: a parser error quotes the reply,
and custom node code that runs while the workflow loads can throw an error under
any name. A failed file read reports its status without the file path.

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
