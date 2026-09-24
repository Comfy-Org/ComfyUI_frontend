# Cloud workflows in Models / Workshop

FE-2736 uses curated catalog data and existing Cloud endpoints. The accepted
architecture is [WORKSHOP-CATALOG-0037](../adr/WORKSHOP-CATALOG-0037-shared-pages-and-authored-execution-catalogs.md).
The frontend review stack contains [catalog and pages #18615](https://github.com/Comfy-Org/ComfyUI_frontend/pull/18615)
and [Cloud rendering #18680](https://github.com/Comfy-Org/ComfyUI_frontend/pull/18680).
No new Cloud service or database deployment is required.

## Content and page ownership

| Source              | Owns                                                                                          |
| ------------------- | --------------------------------------------------------------------------------------------- |
| Master Models pages | Names, copy, examples, supported INPUTS controls and display type                             |
| Router catalog      | Router endpoint request and response declarations                                             |
| Workflow JSONL      | Prepared Cloud graph, input types/defaults, explicit node/input bindings and selected outputs |

A page is visible only when its master entry matches an execution record of the
appropriate type. Discovery, direct routes and page data use that same joined
set. `workshop-workflows-enabled` gates workflow discovery and new runs within
the existing Workshop rollout.

The page uses the existing Models form controls and schema validation. The
workflow composition follows PR #18325, sharing input, output and example
components where their behavior matches. Provider request details belong in the
render adapter, not the form controls.

Workflow metadata is prepared offline by a person or agent and committed to
`apps/website/src/content/workshop-workflows.jsonl`. Each input mapping names
its executable node and input explicitly, including any multiple targets.
The website does not inspect APP selections, execute widget serializers or
compile editor workflows. Custom publisher widgets are outside this feature.
The Workflow tab uses a prepared SVG and the original downloadable JSON.

## Existing Cloud transport

Browser and CLI rendering share request preparation and output normalization.
Browser requests use the caller's current Cloud workspace session. CLI requests
use the caller's API key. Cloud remains authoritative for authorization, plan
checks, job admission and billing.

| Operation                        | Existing endpoint                                                           |
| -------------------------------- | --------------------------------------------------------------------------- |
| Request an input upload          | `POST /api/inputs/upload-url` with the file content type                    |
| Upload bytes                     | Raw `PUT` to the returned Cloud `upload_path`, without account credentials  |
| Submit                           | `POST /api/prompt` with the prepared graph and declared input substitutions |
| Observe and refresh output links | `GET /api/jobs/{prompt_id}?short_link=ephemeral_tool_chain`                 |
| Request cancellation             | `POST /api/jobs/{prompt_id}/cancel`                                         |

The native upload response supplies the filename used in the graph. Only
selected outputs from the authored catalog are presented. Their temporary Cloud
short links support playback and download; rereading the same job refreshes
links without submitting another generation.

Request and media bounds, supported input types and URL checks remain in the
client. Failed requests expose small user-facing errors without raw provider
bodies, credentials or signed URLs in routine logs.

## Browser lifecycle

Form drafts and job records are scoped to the caller and workspace. A known job
ID can be observed again after refresh, reconnect or credential renewal. Account
changes detach the old observer and hide its result. These are browser records,
not a new backend run database or cross-device history.

Persist the pending submission before sending it. If the response is lost and
no job ID is known, show the uncertain outcome and a link to Cloud history.
Do not automatically replay the prompt request: this endpoint does not provide
the stronger idempotency contract proposed earlier.

Keep execution status separate from output availability. A failed download or
missing short link can retry delivery from the same job. Leaving the page does
not cancel a job. Present cancellation as requested because Cloud's displayed
cancelled status is not proof that execution has stopped.

## Adding a workflow

1. Prepare the master page's INPUTS, copy and paired input/output examples.
2. Inspect the source workflow offline and commit the complete execution record,
   source revision, explicit input bindings and selected output mappings.
3. Prepare the Workflow tab assets and verify catalog/default parity with the
   shared validation tests.
4. Exercise the native upload, render and output flow in Cloud before exposure
   through the existing rollout controls.

See the [test strategy](../testing/workshop-cloud-workflows.md) for coverage and
remaining live verification.

## Deferred work

Automatic APP extraction, publication APIs, catalog database tables, durable
server-side submission receipts, background recovery, owned immutable uploads
and sponsored execution are outside the current feature. Backend additions
require agreement from the Cloud team before work resumes.

The earlier proposal is preserved on
[`benjcooley/fe-2736-workshop-runtime-future`](https://github.com/Comfy-Org/ComfyUI_frontend/tree/benjcooley/fe-2736-workshop-runtime-future)
and Cloud PRs [#10444](https://github.com/Comfy-Org/cloud/pull/10444),
[#10445](https://github.com/Comfy-Org/cloud/pull/10445) and
[#10470](https://github.com/Comfy-Org/cloud/pull/10470).
Those PRs are not dependencies of the frontend review stack.
