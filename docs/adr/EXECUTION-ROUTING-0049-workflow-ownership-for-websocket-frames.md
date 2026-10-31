# ADR-EXECUTION-ROUTING-0049: Workflow ownership for execution websocket frames

Date: 2026-10-26

## Status

Proposed

## Context

One `LGraph` and one `LGraphCanvas` serve every open workflow tab, so execution state written by node id is shared state. A run started in one tab painted its progress and outputs onto whichever tab was in front. Reported on #1293, #2660, #6730 and Comfy-Org/ComfyUI#6581, under the umbrella #3377.

[ADR-GRAPH-DOCUMENT-0026](GRAPH-DOCUMENT-0026-frontend-document-model.md) D2 states the rule: a frame arriving on a push channel resolves its target document at ingress via the job map, never via the active pointer. It also states what to do at the boundary — "events with no job→uid resolution (page reloaded mid-run, jobs queued by another client) go to an explicit _unattributed_ bucket rather than being applied to the active document by default … misdelivery is not the fallback."

`#21666` implemented D2's addressing rule for the Agent, keying the ownership gate on `jobIdToWorkflowInstanceId` and gating the node-output and preview paths. That shipped without unit coverage, and without the wire contract Comfy-Org/ComfyUI#16763 and #16809 were merged to provide: the frontend sent no `workflow_metadata`, so the only id the server could stamp came from `extra_pnginfo`.

This ADR records what the resolution order is, why the graph id is its weakest signal, and that the boundary departs from D2.

## Decision

**Resolution order, strongest first.** The open tab's `instanceId`, then the session path, then the workflow id stamped on the frame. When none resolves, the `activeJobId` guard decides.

`instanceId` is the only identifier unique per open tab. A path identifies one open workflow, so it is next. The frame's own workflow id is weakest, because every copy of a graph shares it: `ensureWorkflowId` keeps the id already present in a pasted graph, so copy a workflow, open a tab and paste gives two tabs carrying one id. Keying on it first would make each tab match the other's jobs. Its value is placing a job that no per-tab mapping knows about at all — one queued before a page reload, or by another client — which is the gap `instanceId` alone cannot close and the reason the wire contract exists.

**The all-zero UUID is not an id.** `LGraph._id` defaults to it and the codebase reads it as "no id yet", replacing it on configure and on clear. It is not sent as a routing key, and an incoming one is discarded rather than compared, because comparing it as a real id matches nothing and rejected a fresh graph's own frames. Withholding it from the request does not keep it off the wire: the same graph goes out under `extra_pnginfo` and the server falls back to the id there.

**The stamp is remembered per job, not re-read per frame.** The first stamped frame of a job records `jobId → workflow_id`, and the workflow-id leg reads it when the caller holds no frame. Three callers hold none: `adoptActiveWorkflowJob` on a tab switch, the `executed` events `useReconnectQueueRefresh` rebuilds by hand on reconnect, and `progress_text` when its backend supplies `prompt_id`. Without it those three skipped the leg and reached the `activeJobId` fallback, so a reconnect replay could paint a foreign job's output onto the visible graph — `handleExecutionStart` enrols a job in `queuedJobs` before the gate runs, and the replay follows every job in that map, so a rejected foreign job was still replayed unstamped.

First stamp wins: core merges `workflow_metadata` at `send_sync` enqueue time rather than at publication, so a frame already queued for a job cannot be relabelled by the next prompt, and a later disagreeing stamp belongs to a different job. The map is separate from `jobIdToWorkflowId` on purpose — that one is reactive, exported, and backs `runErrorKeyForJob`, so recording a foreign job's stamp there would file that job's errors against a local tab whenever the two share a graph id, which is the copy-paste case the resolution order exists to handle. Being populated for foreign jobs, it carries its own FIFO bound rather than relying on the local-job eviction paths.

**A rejection by a real identifier is not a diagnostic.** Only a rejection decided by the `activeJobId` fallback is reported, because that is the one leg that guesses. The resolver returns which leg decided; a mismatched instance, path or workflow id is a definite answer. Reporting every rejection raised one `warning_rejecting_unowned_execution_start` per foreign job start on ordinary traffic, since Cloud's per-user fan-out shows every open tab every other tab's job starts.

**Unresolvable frames fall back to the active job.** This is the documented exception to D2's boundary rule. Such a frame is delivered to the tab in front when no job is active or the frame belongs to `activeJobId`, rather than quarantined. A frame with no `prompt_id` is always delivered.

**What is gated is decided by the consumer's key, not by the frame being foreign.** Node-keyed writes are gated, because the visible graph may hold the same node ids. Job-keyed writes are not: `useJobPreviewStore().setPreviewUrl` feeds the queue panel thumbnail for a background run. Account-level signals are not, because a sign-in or credit precondition belongs to the account rather than to one workflow.

## Alternatives considered

**Quarantine unresolvable frames, as D2 prescribes.** Rejected. The common unresolvable case is a page reloaded mid-run, where the mappings are gone and the only open tab is the one being looked at. Quarantining would stop a single-tab user's own run updating after a refresh, a regression for the common case in service of a rule written for the multi-tab case. D2's boundary also assumes a surfacing UI for the unattributed bucket, which does not exist.

**Gate on the workflow id alone.** This was tried on #20045 and was wrong, for the copy-paste reason above. Recorded because the id looks like the obvious key.

The same id-first shape is still open on #11951, which proposes a `messageMatchesActiveWorkflow` resolver consulting the frame's workflow id ahead of session ownership, and it is the inverse of the order decided here. Two tabs holding one copied graph id would match each other's jobs under it, which is exactly what the instance and path legs exist to prevent. Its resolver is therefore superseded by this ADR; remaining work on that branch should be carried onto this gate rather than restoring the competing policy during integration. #20982 overlaps the same seam and is covered by the same ruling. Whichever of #22186's move of the API and execution contracts into `packages/api-client` lands second has to carry this PR's request field, preview decoding and stamped types into that package.

**A `contextvars` owner on the backend.** Rejected on a mechanism error: `prompt_worker` is a daemon thread and `send_json` runs on the event loop, so a ContextVar set in the worker is unset at send time. The attribute merged in the body of `send_sync` is what shipped.

## Consequences

**The `activeJobId` fallback is load-bearing and is the weakest point.** Single-tab behaviour after a reload is preserved, and it is narrower than a blanket permissive rule, since a foreign job's unresolvable frame is dropped while another job is active. What remains is that with two tabs open and a frame unresolvable, it can land on the wrong one.

**`status` and current core `progress_text` both stay unattributable.** Neither supplies a `prompt_id` to the gate. `status` carries none because one server-wide socket serves every workflow. `progress_text` is a packed binary frame that `send_sync` cannot stamp, and the frontend decodes a job id out of it only when the server sets `supports_progress_text_metadata`, which no core version does — tracked as Comfy-Org/ComfyUI#16887. With the flag absent the gate is called with no job id at all, so it returns before any remembered-stamp lookup, and #16887 is what unblocks the leg rather than merely improving its first frame. A backend that does supply `prompt_id` gets the remembered workflow stamp without having to add `workflow_id` to every text frame.

**The two backends merge in opposite orders.** Core merges `{**workflow_metadata, **data}`, so a frame's own fields win. The Cloud gateway assigns `prompt_id` and `workflow_id` after the fact, so the backend wins, and it does not read `workflow_metadata` at all. Neither order should be relied on; the routing ids that arrive are authoritative whichever side set them.

**Revisit if** an unattributed-frame surface is built, at which point D2's boundary becomes implementable and this exception should be removed rather than inherited.
