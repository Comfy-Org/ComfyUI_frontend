# ADR-EXECUTION-ROUTING-0045: Workflow ownership for execution websocket frames

Date: 2026-10-17

## Status

Proposed

## Context

One `LGraph` and one `LGraphCanvas` serve every open workflow tab, so execution state written by node id is shared state. A run started in one tab painted its progress, outputs and run status onto whichever tab was in front. Reported on #1293, #2660, #6730 and Comfy-Org/ComfyUI#6581, under the umbrella #3377, and reproduced by manual QA with three pasted copies of one graph.

[ADR-GRAPH-DOCUMENT-0026](GRAPH-DOCUMENT-0026-frontend-document-model.md) D2 already states the rule: a frame arriving on a push channel resolves its target document at ingress via the job map, never via the active pointer. It also states what to do at the boundary — "events with no job→uid resolution (page reloaded mid-run, jobs queued by another client) go to an explicit _unattributed_ bucket rather than being applied to the active document by default … misdelivery is not the fallback."

This change implements D2's addressing rule and **departs from its boundary rule**.

## Decision

**Resolution order, strongest first.** A frame's owner is resolved by the open tab's `instanceId`, then the session path, then the workflow's graph id. When none of these resolves, the `activeJobId` guard decides.

The graph id is deliberately the weakest signal, not the strongest. `ensureWorkflowId` keeps the id already present in a pasted graph, so copy a workflow, open a tab and paste gives two tabs carrying one id; loading a single workflow has also been measured leaving two open entries holding it. Keying on the graph id first is the bug QA found, where every tab sharing an id matched every job. `instanceId` is the only identifier unique per open tab, and it already existed.

**The all-zero UUID is not an id.** `LGraph._id` defaults to it and the codebase reads it as "no id yet", replacing it on configure and on clear. It is not sent as a routing key, and an incoming one is discarded rather than compared. It still reaches the wire, because core falls back to the id inside `extra_data.extra_pnginfo.workflow`, and comparing it as a real id rejected a fresh graph's own frames.

**Unresolvable frames fall back to the active job.** This is the documented exception to D2's boundary rule. When no mapping and no usable id exist, the frame is delivered to the tab in front if no job is active or the frame belongs to `activeJobId`, rather than quarantined. A frame with no `prompt_id` is always delivered.

**Keys decide gating, not foreignness.** A frame being from another tab is not sufficient reason to drop work. What matters is the key the consumer reads:

- Node-keyed writes (node progress, node outputs, node previews, text previews) are gated, because the visible graph may hold the same node ids.
- Job-keyed writes are not. `useJobPreviewStore().setPreviewUrl` feeds the queue panel's thumbnail and `linearOutputStore`'s re-apply on return, both for background jobs.
- Account-level signals are not. A sign-in, subscription or credit precondition belongs to the account, and `handleAccountPreconditionError` returns before recording the error, so its dialog is the only signal a background run produces.

**Finished background jobs release their own records.** A job whose tab is not in front still ends, so each terminal path releases its per-job state rather than returning early at the gate.

## Alternatives considered

**Quarantine unresolvable frames, as D2 prescribes.** Rejected for this change. The common unresolvable case is a page reloaded mid-run, where the mappings are gone and the only open tab is the one the user is looking at. Quarantining would make a single-tab user's own run stop updating after a refresh — a regression for the overwhelmingly common case, in service of a rule written for the multi-tab case. D2's boundary also assumes a surfacing UI for the unattributed bucket, which does not exist.

**Gate on the graph id alone.** This shipped and was wrong; see above. It is recorded here because the id looks like the obvious key and the mistake is easy to repeat.

**A `contextvars`-based owner on the backend.** Rejected on a verified mechanism error: `prompt_worker` is a daemon thread and `send_json` runs on the event loop, so a ContextVar set in the worker is unset at send time. The attribute set on `PromptServer` and merged in the body of `send_sync` is what ships (Comfy-Org/ComfyUI#16763, #16809).

**Derive the shared node-progress mirror instead of maintaining it.** Deferred to #20604, not rejected. It is read by the canvas sync path on every frame, so making it a computed changes when that work happens relative to painting, which is the interaction the original bug lived in.

## Consequences

**The `activeJobId` fallback is load-bearing and is also the weakest point.** Single-tab behaviour after a reload is preserved. A job from another browser session reaches the tab in front only when nothing else is running or it is itself the active job, so it is narrower than a blanket permissive rule. What remains is that with two tabs open and a frame unresolvable, it can still land on the wrong one. The blast radius is bounded by how rarely those conditions coincide, not by the design.

**`status` and `progress_text` frames stay unattributable.** `status` carries no `prompt_id` because one server-wide socket serves every workflow. `progress_text` is a packed binary frame that `send_sync` cannot stamp; the frontend already reads a `supports_progress_text_metadata` server flag that no core version sets. Tracked as Comfy-Org/ComfyUI#16887. Until it lands, the text-preview widget gate goes permissive.

**The two backends disagree on merge order.** Core merges `{**workflow_metadata, **data}`, so a frame's own fields win. The Cloud gateway assigns `prompt_id` and `workflow_id` after the fact, so the backend wins. Neither order should be relied on; the routing ids that arrive are authoritative whichever side set them.

**Revisit if** an unattributed-frame surface is built, at which point D2's boundary rule becomes implementable and this exception should be removed rather than inherited.
