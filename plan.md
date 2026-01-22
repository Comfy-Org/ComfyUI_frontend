# Parallel Execution Implementation Plan

## Goals
- Support multiple simultaneous workflow executions across:
  - Separate browser tabs (multiple clients).
  - In-app workflow tabs (multiple workflows).
- Show correct progress, outputs, and errors per workflow/job.
- Avoid regressions for single-run behavior and existing UI.

## Non-goals (initial scope)
- Redesign the queue UI beyond enabling per-job progress indicators.
- New backend features beyond prompt context for WS events (see dependencies).

## Dependencies / coordination (verified vs `../cloud-3` + `../backend-3`)
- Prompt-scoped data is already available for core execution events:
  - `execution_start`, `execution_success`, `execution_error`, `execution_interrupted`,
    `executed`, `progress`, `progress_state`, and `executing` include `prompt_id` in
    `../backend-3` and are forwarded unchanged through `../cloud-3`.
  - Frontend currently *drops* `prompt_id` for `executing`; this can be fixed
    without backend changes.
- `progress_text` is a binary message containing only `nodeId` + text in
  `../backend-3` (`send_progress_text`); `../cloud-3` forwards it as raw binary.
  - Per-prompt progress text is **not possible** without backend changes.
  - If we want it, we need to extend ComfyUI/backend to include `prompt_id` in
    the binary payload or add a parallel JSON event.
- `b_preview_with_metadata` includes `prompt_id` and is forwarded as binary; usable
  as-is for prompt/workflow scoping.
- Decide whether UI should filter by `client_id` (current tab only) or show all
  user jobs; document and apply consistently.

## Phase 1: Data model and execution state
1. Refactor execution store to be prompt-centric:
   - Replace `activePromptId` single value with:
     - `promptStates: Record<promptId, PromptExecutionState>`.
     - `runningPromptIds` derived from prompt states.
     - `promptIdToWorkflowId` remains the primary routing map.
   - Provide selectors:
     - `getPromptProgress(promptId)`
     - `getPromptNodeProgressStates(promptId)`
     - `getWorkflowRunningPromptIds(workflowId)`
     - `getActivePromptForWorkflow(workflowId)` (if needed)
   - Redefine `isIdle` as `runningPromptIds.length === 0`.
   - Keep backward-compat getters but scope to:
     - active workflow tab, or
     - "most recently started prompt".

2. Update event handlers to write prompt-scoped state:
   - `execution_start` creates prompt state.
   - `progress_state` merges into `promptStates[promptId].nodeProgressStates`.
   - `execution_success/error/interrupted` remove prompt state only for that id.
   - Preserve initialization tracking per prompt.

## Phase 2: Prompt-aware node progress and canvas updates
1. Update graph/node progress to be scoped to the active workflow tab:
   - Derive `nodeLocationProgressStates` from the prompt(s) mapped to the
     active workflow only.
   - Ensure `GraphCanvas.vue` applies progress for active workflow only.
2. Update vue-node execution composables to use workflow-scoped progress.
3. Update `groupNode` progress rendering to use prompt-scoped state.

## Phase 3: Outputs and previews isolation
1. Introduce per-workflow output maps in `imagePreviewStore`:
   - `outputsByWorkflowId[workflowId][nodeLocatorId]`.
   - `previewsByWorkflowId[workflowId][nodeLocatorId]`.
2. When switching active workflow tab:
   - Swap `app.nodeOutputs` and `app.nodePreviewImages` to the selected map.
3. Update `executed` and `b_preview_with_metadata` handlers to:
   - Use `prompt_id -> workflowId` mapping to store outputs/previews in the
     correct workflow bucket.
4. Update `ChangeTracker` and history loading paths to restore per-workflow
   outputs without overwriting other workflows.

## Phase 4: UI updates for multi-run visibility
1. Queue overlay:
   - `useQueueProgress` to compute per-job progress for all running tasks.
   - `useJobList` to attach progress to each running item, not just one.
   - `QueueOverlayActive` to show aggregated or multi-job state.
2. Actionbar interrupt:
   - Route interrupt to prompt(s) for the active workflow tab.
   - Optionally add a "stop all running" action.
3. Browser tab title + favicon:
   - Use aggregate progress (e.g., max or average of running jobs) or show
     count of running jobs with a generic progress indicator.

## Phase 5: Browser-tab concurrency policy
1. Decide and implement filtering:
   - Option A: show only jobs for the current `client_id` in the UI.
   - Option B: show all jobs for the user, but mark which client started them.
2. Apply consistent filtering in:
   - queue overlay,
   - completion summary,
   - progress favicon/title.

## Phase 6: Tests and validation
- Unit tests:
  - `executionStore` selectors and lifecycle per prompt.
  - `useQueueProgress` and `useJobList` showing per-job progress.
- Update existing stories/tests that assume single `activePromptId`.
- Manual validation checklist:
  - Two workflows running in two in-app tabs: progress and outputs isolated.
  - Two browser tabs running distinct workflows: no cross-talk in UI.
  - Interrupt from actionbar affects intended prompt(s).

## Phase 7: Rollout and cleanup
- Remove deprecated single-prompt fields after migration is stable.
- Update documentation/comments where prompt-scoped behavior is required.
- Coordinate backend/WS schema changes with `../backend-3` and `../cloud-3`.
