# 23. Asset Deletion Preserves the Owning Job

Date: 2026-08-27

## Status

Accepted

Ratified at Domain Modeling Weekly on 2026-08-06. Deciders: Christian Byrne,
Hunter Senft-Grupp, Jaewon Yoon. This ADR mirrors that decision into the repo
so implementation and tests can cite it directly.

## Context

Assets and history jobs are distinct entities with independent lifecycles. A
job (a history entry) produces one or more output assets; an asset belongs to
exactly one job. As the assets surface replaces direct history-based output
browsing, the frontend needs a single answer to what deleting each entity
means, because implementations that couple the two lifecycles destroy user
data the user did not ask to delete.

Concretely, the questions that kept recurring:

- Does deleting an asset delete the job that produced it?
- Is an asset's visibility derived from its job's state?
- What does deleting a job do to the assets it produced?
- When a grouped output (a job with multiple outputs) is deleted, what IDs are
  actually deleted?
- What must deletion UI disclose?

## Decision

The lifecycle split is directional: jobs fan out to assets, never the reverse.

1. **Asset deletion never deletes the owning job.** Deleting an asset removes
   that asset only. The job and its history entry remain.
2. **Asset visibility is not derived from job state.** An asset's presence in
   listings is a property of the asset, not of whether its job still exists.
3. **Job deletion fans out to its assets.** Deleting a job deletes the assets
   it produced.
4. **Grouped deletes name real asset IDs.** Deleting a grouped output resolves
   and deletes actual asset IDs, never a synthetic group or job-derived ID.
5. **Deleting one output preserves its siblings and the job.** Removing one
   asset from a multi-output job leaves the other outputs and the job intact.
6. **Delete UI must disclose that the job remains.** Confirmation copy for
   asset deletion states that the generation (job/history entry) is preserved.

## Consequences

- Asset delete actions must not call history/job deletion endpoints, directly
  or as a follow-up step.
- Confirmation dialogs for asset deletion must not claim the item is
  "permanently removed" without stating the job survives.
- Tests that assert job deletion as a side effect of asset deletion codify a
  violation of this decision and need updating alongside the implementation.
- Job deletion flows may (and should) delete produced assets; that direction
  is the sanctioned fan-out.
- Any future proposal to derive asset visibility from job state (or vice
  versa) needs a superseding ADR.
