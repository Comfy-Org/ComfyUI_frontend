# Cloud workflow test strategy

The current scope is catalog-driven pages using existing Cloud endpoints, as
recorded in [WORKSHOP-CATALOG-0037](../adr/WORKSHOP-CATALOG-0037-shared-pages-and-authored-execution-catalogs.md).
Tests for the earlier publication compiler, backend run store and immutable
upload service belong to the deferred branches, not the frontend release gates.

## Catalog and shared forms

Use the real prepared workflow records and shared Models validation to check:

- Master pages and execution records must match before a page becomes visible.
- Input types, explicit bindings, defaults and selected outputs are consistent.
- Widget order comes from the master page. False, zero and empty defaults survive.
- Invalid or unknown input fields and incompatible mappings fail before execution.
- Discovery data omits executable graphs; runnable detail data contains the
  prepared graph and mappings required by native Cloud submission.
- Examples pair the original input with its output and restore inputs through
  the shared replacement confirmation.

The catalog and page tests are in
`apps/website/src/config/workshop-workflow-*.test.ts`.
The workflow rollout and route tests are in
`apps/website/e2e/workshop-workflows.spec.ts`.

## Runtime coverage

The runtime corpus in [PR #18680](https://github.com/Comfy-Org/ComfyUI_frontend/pull/18680)
exercises the shared browser/CLI helper, native Cloud adapter and page lifecycle.
Use behavioral assertions at the lowest level that proves the boundary.

| Boundary            | Required behavior                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Request preparation | Form and CLI defaults agree; only declared fields reach the prepared graph                                         |
| Upload              | Native grant then raw PUT; caller credentials stay off the PUT; malformed grants/results fail                      |
| Authentication      | Token renewal retries the same request body; changed users or workspaces cannot receive old results                |
| Submission          | A lost POST response is not automatically resubmitted; a known job resumes with reads only                         |
| Observation         | Queue, running and terminal states come from the native job response; stale responses cannot replace current state |
| Cancellation        | Cancel targets the known job; the UI reports a request without promising execution has stopped                     |
| Delivery            | Only selected Cloud short links become outputs; partial or expired delivery rereads the same job                   |
| Drafts              | IndexedDB preserves file bytes across refresh and sign-in handoff within the caller scope                          |
| Navigation          | Playground, Workflow and API tabs retain form state; example selection cannot create another job                   |

Existing runtime tests use native Cloud response fixtures and real File,
Response, streams and IndexedDB objects. Browser tests submit actual fixture
bytes through mocked upload grants and PUT requests. They verify refresh,
output playback/download, cancellation requests, disabled new runs and sign-out.
No real paid generation occurs in automated tests.

## Checks and live verification

Run focused unit tests, website typecheck, lint, formatting, Knip and a production
website build. Run the workflow browser scenarios against that build, plus the
existing Router page regression scenarios when shared components change. Check
desktop and mobile presentation when the page changes.

The shared helper completed one real production background-removal run through
native upload, generation and original PNG download. This proves that pilot's
request path; it is not evidence of all templates, staging billing or confirmed
cancellation. Browser fixture tests do not substitute for those live checks.

Before broader rollout, verify the following with the intended Cloud account:

- Each prepared workflow accepts its declared inputs and returns its selected
  outputs for playback and download.
- The signed-in browser flow uses the selected workspace and its normal credits.
- Refresh observes the same job and output-link refresh does not rerun inference.
- Cancellation requests and uncertain-submission guidance match native behavior.
- Account switching and feature-flag changes preserve the caller boundaries.

Keep rollout within the existing staged controls until those checks are
recorded. New backend recovery guarantees are not part of this acceptance list.
