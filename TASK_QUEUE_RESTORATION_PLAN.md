# Task Queue Restoration Plan

## Problem Statement

An accidental revert occurred in commit range `730b278f..8075db41f` that removed critical task queue and client_id-aware changes from the manager system. Since then, months of additional features have been built on top of the reverted (broken) state.

## What We CANNOT Do

- ❌ Simple git revert - would lose months of subsequent work
- ❌ Cherry-pick entire files - would overwrite newer features  
- ❌ Restore entire files to previous state - would break new functionality

## What We MUST Do

**Manual analysis and selective restoration** for each affected file:

1. **Compare each file** between:
   - `730b278f` (correct task queue implementation) 
   - `8075db41f` (after accidental revert)
   - `current state` (months of features built on broken foundation)

2. **Identify specific changes** that were lost in the revert:
   - **Task queue API usage** (`QUEUE_TASK = 'v2/manager/queue/task'`)
   - **Generated types migration** (`components` from `generatedManagerTypes` ONLY, stop using `comfyManagerTypes.ts`)
   - **Client ID awareness** (`client_id` parameters in all API calls)
   - **UUID generation** for task tracking (`ui_id` with `uuidv4()`)
   - **Task history features** (`getTaskHistory`, `TASK_HISTORY` routes)
   - **Proper task queueing logic** (`queueTask` function that creates `QueueTaskItem`)

3. **Selectively restore** only the task queue changes while preserving:
   - All feature flag logic added since the revert
   - All UI enhancements added since the revert  
   - All new components and functionality added since the revert
   - All bug fixes and improvements added since the revert

## Key Migration Pattern

**CRITICAL**: Switch from `comfyManagerTypes.ts` to `generatedManagerTypes.ts`:

```typescript
// OLD (reverted state):
import { type InstallPackParams } from '@/types/comfyManagerTypes'

// NEW (correct task queue state):
import { components } from '@/types/generatedManagerTypes'
type InstallPackParams = components['schemas']['InstallPackParams']
```

## Files Requiring Analysis

1. `src/services/comfyManagerService.ts` ✅ COMPLETED
2. `src/stores/comfyManagerStore.ts` 
3. `src/types/comfyManagerTypes.ts` (check if it should be deprecated)
4. `src/composables/useManagerQueue.ts`
5. `src/components/dialog/content/manager/ManagerDialogContent.vue`
6. `src/components/dialog/content/ManagerProgressDialogContent.vue`
7. `src/components/dialog/footer/ManagerProgressFooter.vue`
8. Manager button components (PackInstallButton, PackUpdateButton, etc.)
9. Manager pack card components
10. Related test files

## Analysis Process for Each File

For each file:

1. **Extract the correct implementation**: `git show 730b278f:path/to/file.ts`
2. **Extract the reverted implementation**: `git show 8075db41f:path/to/file.ts` 
3. **Compare with current state**: What we have now
4. **Identify lost task queue features**: What specific functionality was removed
5. **Manually merge**: Add back only the task queue features to current code
6. **Preserve new features**: Keep all functionality added since the revert

## Expected Outcome

- Manager operations use proper task queue API (`/v2/manager/queue/task`)
- All operations include `client_id` and `ui_id` for tracking
- Task history is properly implemented
- **Generated types are used exclusively** instead of manual `comfyManagerTypes.ts`
- UUID generation works for task identification
- ALL existing features and enhancements since the revert are preserved