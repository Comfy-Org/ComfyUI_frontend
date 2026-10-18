import type {
  ComfyWorkflow,
  WorkflowChangeTracker
} from '@/platform/workflow/management/stores/comfyWorkflow'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'

interface ChangeTrackerClass {
  new (
    workflow: ComfyWorkflow,
    initialState: ComfyWorkflowJSON
  ): WorkflowChangeTracker
  readonly isLoadingGraph: boolean
}

/** `ChangeTracker` for the stores it imports, which cannot import it back. */
export let ChangeTrackerAccess: ChangeTrackerClass

/** Called by `changeTracker` when it loads. */
export function provideChangeTracker(tracker: ChangeTrackerClass): void {
  ChangeTrackerAccess = tracker
}
