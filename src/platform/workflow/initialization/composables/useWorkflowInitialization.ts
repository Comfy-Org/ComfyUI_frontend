import { workflowSources } from '../workflowSources'

/**
 * Composable for initializing workflows on app startup
 *
 * Uses a strategy pattern to select the appropriate workflow source.
 * Sources are checked in priority order, and the first matching source is used.
 *
 * Current sources (in priority order):
 * 1. Template URL (?template=name&source=module)
 * 2. Saved workflow (localStorage/sessionStorage)
 *
 * To add new sources, see workflowSources.ts
 */
export function useWorkflowInitialization() {
  /**
   * Initializes workflows on app startup.
   *
   * Finds the first applicable workflow source and loads from it.
   * Falls back to saved workflow if no other source applies.
   */
  const initializeWorkflows = async () => {
    // Find first applicable source
    const source = workflowSources.find((s) => s.shouldLoad())

    if (source) {
      await source.load()
    } else {
      // This should never happen since savedWorkflowSource always returns true
      console.warn('[WorkflowInit] No workflow source found')
    }
  }

  return { initializeWorkflows }
}
