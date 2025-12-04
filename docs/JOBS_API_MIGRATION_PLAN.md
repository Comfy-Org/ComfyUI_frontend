# Jobs API Migration Plan

## Overview

This document outlines the strategy for breaking up the Jobs API migration PR (#7125) into smaller, reviewable chunks.

## Current State

The PR migrates the frontend from legacy `/history` and `/queue` endpoints to the unified `/jobs` API. This involves:

- **24 source files** changed
- **16 test files** changed
- Core changes to `TaskItemImpl` in `queueStore.ts`

## Dependency Analysis

```
jobTypes.ts (types)
    ↓
fetchJobs.ts (fetchers)
    ↓
api.ts (API layer)
    ↓
queueStore.ts (TaskItemImpl rewrite)
    ↓
┌───────────────────────────────────────┐
│  All consumers must update together:  │
│  - useJobList.ts                      │
│  - useJobMenu.ts                      │
│  - useResultGallery.ts                │
│  - useJobErrorReporting.ts            │
│  - JobGroupsList.vue                  │
│  - assetsStore.ts                     │
│  - reconciliation.ts                  │
└───────────────────────────────────────┘
```

## Proposed PR Split

### PR 1: Jobs API Infrastructure (Foundation)
**Status**: Can merge independently
**Risk**: Low - purely additive

Files:
```
src/platform/remote/comfyui/jobs/types/jobTypes.ts    (new)
src/platform/remote/comfyui/jobs/fetchers/fetchJobs.ts (new)
src/platform/remote/comfyui/jobs/index.ts             (new)
src/scripts/api.ts                                    (add new methods)
```

Changes:
- Add Zod schemas for Jobs API response types
- Add `fetchQueue()` and `fetchHistory()` functions using `/jobs` endpoint
- Add `getQueue()` and `getHistory()` methods to ComfyApi class
- Export types from barrel file

Tests:
- Unit tests for fetchers
- Integration tests for API methods

**Why separate?** This is purely additive. The new code exists alongside the old code without breaking anything. Can be reviewed and merged first.

---

### PR 2: Core Migration (TaskItemImpl + Consumers)
**Status**: Requires PR 1
**Risk**: Medium - breaking changes to core data model

Files:
```
src/stores/queueStore.ts                              (rewrite TaskItemImpl)
src/schemas/apiSchema.ts                              (type updates)
src/composables/queue/useJobList.ts                   (use new TaskItemImpl)
src/composables/queue/useJobMenu.ts                   (use new TaskItemImpl)
src/composables/queue/useResultGallery.ts             (use new TaskItemImpl)
src/components/queue/job/useJobErrorReporting.ts      (use new TaskItemImpl)
src/components/queue/job/JobGroupsList.vue            (fix workflowId access)
src/components/queue/QueueProgressOverlay.vue         (if needed)
src/stores/assetsStore.ts                             (use JobListItem)
src/platform/remote/comfyui/history/reconciliation.ts (work with JobListItem)
src/platform/workflow/cloud/getWorkflowFromHistory.ts (use fetchJobDetail)
src/scripts/ui.ts                                     (type fix)
```

Changes:
- Rewrite `TaskItemImpl` to wrap `JobListItem` instead of legacy tuple format
- Update all getters to derive from job properties
- Update all consumers to use new property names
- Update reconciliation to work with `JobListItem[]`

Tests:
- All queue-related tests
- queueStore tests
- Integration tests

**Why together?** These changes are tightly coupled. `TaskItemImpl` API changes break all consumers, so they must be updated atomically.

---

### PR 3: Cleanup Legacy Code
**Status**: Requires PR 2
**Risk**: Low - removing unused code

Files to DELETE:
```
src/platform/remote/comfyui/history/adapters/v2ToV1Adapter.ts
src/platform/remote/comfyui/history/fetchers/fetchHistoryV1.ts
src/platform/remote/comfyui/history/fetchers/fetchHistoryV2.ts
src/platform/remote/comfyui/history/types/historyV1Types.ts
src/platform/remote/comfyui/history/types/historyV2Types.ts
tests-ui/fixtures/historyFixtures.ts
tests-ui/fixtures/historySortingFixtures.ts
+ related test files
```

Files to MODIFY:
```
src/platform/remote/comfyui/history/index.ts          (remove old exports)
src/platform/remote/comfyui/history/types/index.ts    (remove old exports)
```

**Why separate?** Deletion is low-risk but should be done after confirming the new code works in production. Allows rollback if issues are found.

---

## Alternative: Feature Flag Approach

If the above split is still too risky, consider:

1. Add feature flag `useJobsApi` (default: false)
2. Keep both code paths in TaskItemImpl
3. Gradually roll out via feature flag
4. Remove old code path after validation

This is more complex but allows incremental rollout.

---

## Recommended Order

1. **PR 1** → Merge first (no risk)
2. **PR 2** → Merge after PR 1 (main migration)
3. **PR 3** → Merge after validating PR 2 in production

## Current PR Status

The current PR (#7125) contains PR 1 + PR 2 combined. To split:

1. Create new branch from main
2. Cherry-pick only the Jobs API infrastructure commits
3. Open PR 1
4. Rebase current branch on PR 1 after merge
5. Current branch becomes PR 2

---

## Files by PR

### PR 1 Files (8 files)
```
src/platform/remote/comfyui/jobs/types/jobTypes.ts
src/platform/remote/comfyui/jobs/fetchers/fetchJobs.ts
src/platform/remote/comfyui/jobs/index.ts
src/scripts/api.ts
+ 4 test files
```

### PR 2 Files (~28 files)
```
src/stores/queueStore.ts
src/stores/assetsStore.ts
src/schemas/apiSchema.ts
src/scripts/ui.ts
src/composables/queue/useJobList.ts
src/composables/queue/useJobMenu.ts
src/composables/queue/useResultGallery.ts
src/components/queue/job/useJobErrorReporting.ts
src/components/queue/job/JobGroupsList.vue
src/components/queue/job/JobDetailsPopover.stories.ts
src/components/queue/QueueProgressOverlay.vue
src/platform/remote/comfyui/history/reconciliation.ts
src/platform/remote/comfyui/history/index.ts
src/platform/workflow/cloud/getWorkflowFromHistory.ts
src/platform/workflow/cloud/index.ts
browser_tests/fixtures/ComfyPage.ts
browser_tests/fixtures/utils/taskHistory.ts
+ ~12 test files
```

### PR 3 Files (~12 files to delete)
```
DELETE: src/platform/remote/comfyui/history/adapters/*
DELETE: src/platform/remote/comfyui/history/fetchers/fetchHistoryV1.ts
DELETE: src/platform/remote/comfyui/history/fetchers/fetchHistoryV2.ts
DELETE: src/platform/remote/comfyui/history/types/historyV1Types.ts
DELETE: src/platform/remote/comfyui/history/types/historyV2Types.ts
DELETE: tests-ui/fixtures/history*.ts
DELETE: related test files
MODIFY: index.ts files to remove exports
```
