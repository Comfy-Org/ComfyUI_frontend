# Parallel Workflow Execution - Initial Findings

## Cloud PR 1743 behavior

- The PR enables parallel execution by making the per-user concurrency limit
  dynamic: `DispatchConfig.MaxConcurrentJobsPerUser` is added and read at runtime.
- Dispatcher passes the runtime value into the state machine via
  `TriggerEventGloballyWithArgs`, so changes apply without restart.
- State machine uses the runtime limit to move jobs from `queued_limited` to
  `queued_waiting`, which is the gate for concurrent execution.
- Environment defaults set local/ephemeral/dev to 5 and staging/prod to 1.

Key references:
- `common/dynamicconfig/types.go`
- `services/dispatcher/server/services/job_dispatch/dispatcher.go`
- `common/jobstate/state.go`
- `common/dynamicconfig/defaults/ephemeral.json`
- `infrastructure/dynamicconfig/prod/config.json`
- `infrastructure/dynamicconfig/staging/config.json`
- `infrastructure/dynamicconfig/dev/config.json`

## Frontend audit notes (current behavior)

- Queue fetching already supports multiple running/pending jobs via `/jobs`,
  mapping to `Running`/`Pending` lists.
  - `src/platform/remote/comfyui/jobs/fetchJobs.ts`
  - `src/stores/queueStore.ts`
- The concurrency indicator is based on `runningWorkflowCount`, which counts
  prompts with running nodes and should reflect parallel execution.
  - `src/stores/executionStore.ts`
  - `src/components/queue/QueueProgressOverlay.vue`
- The progress overlay is single-prompt focused:
  - `executionStore.activePromptId` tracks one prompt.
  - `nodeProgressStates` is overwritten per `progress_state`, so the progress
    bar and current node are effectively “last prompt wins.”
  - `src/stores/executionStore.ts`
  - `src/components/queue/QueueProgressOverlay.vue`

## Implication

If the frontend is expected to show per-job progress for multiple concurrent
workflows, the execution store and progress overlay will need to evolve beyond
the single-active-prompt assumption.
