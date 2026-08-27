<<<<<<<< HEAD:docs/adr/0026-asset-deletion-preserves-owning-job.md
# 23. Asset Deletion Preserves the Owning Job
========
# 24. Output Asset Deletion Preserves the Owning Job
>>>>>>>> 27a3560cf (docs: renumber output asset deletion ADR):docs/adr/0024-output-asset-deletion-preserves-owning-job.md

Date: 2026-08-27

## Status

Accepted

Ratified at Domain Modeling Weekly on 2026-08-06. Deciders: Christian Byrne,
Hunter Senft-Grupp, Jaewon Yoon. This ADR mirrors that decision into the repo
so implementation and tests can cite it directly.

## Context

Generated output assets and history jobs are distinct entities with independent
lifecycles. A job (a history entry) produces one or more output assets; each
generated output asset belongs to exactly one job. `OutputAssetMetadata`
therefore requires a `jobId`, while the general `AssetItem` schema does not.
Input assets and model assets do not have an owning history job and are outside
this decision. As the assets surface replaces direct history-based output
browsing, the frontend needs a single answer to what deleting each output asset
or job means, because implementations that couple the two lifecycles destroy
user data the user did not ask to delete.

Concretely, the questions that kept recurring:

- Does deleting an output asset delete the job that produced it?
- Is an output asset's visibility derived from its job's state?
- What does deleting a job do to the assets it produced?
- When a grouped output (a job with multiple outputs) is deleted, what IDs are
  actually deleted?
- What must deletion UI disclose?

## Decision

The lifecycle split is directional: jobs fan out to their generated output
assets, never the reverse.

1. **Output asset deletion never deletes the owning job.** Deleting a generated
   output asset removes that asset only. The job and its history entry remain.
2. **Output asset visibility is not derived from job state.** A generated output
   asset's presence in listings is a property of the asset, not of whether its
   job still exists.
3. **Job deletion fans out to its assets.** Deleting a job deletes the assets
   it produced.
4. **Grouped deletes name real asset IDs.** Deleting a grouped output resolves
   and deletes actual asset IDs, never a synthetic group or job-derived ID.
5. **Deleting one output preserves its siblings and the job.** Removing one
   asset from a multi-output job leaves the other outputs and the job intact.
6. **Delete UI must disclose that the job remains.** Confirmation copy for
   asset deletion states that the generation (job/history entry) is preserved.

## Consequences

- Output asset delete actions must not call history/job deletion endpoints,
  directly or as a follow-up step.
- Confirmation dialogs for output asset deletion must not claim the item is
  "permanently removed" without stating the job survives.
- Tests that assert job deletion as a side effect of output asset deletion
  codify a violation of this decision and need updating alongside the
  implementation.
- Job deletion flows may (and should) delete produced assets; that direction
  is the sanctioned fan-out.
- Any future proposal to derive asset visibility from job state (or vice
  versa) needs a superseding ADR.
