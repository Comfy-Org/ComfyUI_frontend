import { useRoute } from 'vue-router'

import { useWorkflowPersistence } from '@/platform/workflow/persistence/composables/useWorkflowPersistence'
import { useTemplateUrlLoader } from '@/platform/workflow/templates/composables/useTemplateUrlLoader'

/**
 * Represents a source from which workflows can be loaded during app initialization
 * @public - exported for extensibility (e.g., custom workflow sources in extensions)
 */
export interface WorkflowInitializationSource {
  /**
   * Display name for debugging/logging
   */
  name: string

  /**
   * Check if this source should be used for initialization
   */
  shouldLoad: () => boolean

  /**
   * Load the workflow from this source
   */
  load: () => Promise<void>
}

/**
 * Template from URL query parameters
 * Example: /?template=flux_simple&source=custom
 *
 * Priority: 1 (highest - loads alongside saved workflow)
 * Behavior: Restores saved workflow as background tab, loads template as active tab
 * @public - exported for reference/testing
 */
export const templateUrlSource: WorkflowInitializationSource = {
  name: 'Template URL',
  shouldLoad: () => {
    const route = useRoute()
    return !!(route.query.template && typeof route.query.template === 'string')
  },
  load: async () => {
    // First restore saved workflow (becomes background tab)
    await useWorkflowPersistence().restorePreviousWorkflow()
    // Then load template (becomes active tab)
    await useTemplateUrlLoader().loadTemplateFromUrl()
  }
}

/**
 * Saved workflow from localStorage/sessionStorage
 *
 * Priority: 2 (fallback if no other source applies)
 * Behavior: Restores the last saved workflow or loads default/blank
 * @public - exported for reference/testing
 */
export const savedWorkflowSource: WorkflowInitializationSource = {
  name: 'Saved Workflow',
  shouldLoad: () => true, // Always available as fallback
  load: async () => {
    await useWorkflowPersistence().restorePreviousWorkflow()
  }
}

/**
 * Ordered list of workflow sources to check on initialization.
 * First matching source wins.
 *
 * To add a new source:
 * 1. Create a WorkflowInitializationSource object
 * 2. Add it to this array in priority order (higher priority = earlier in array)
 */
export const workflowSources: WorkflowInitializationSource[] = [
  templateUrlSource,
  savedWorkflowSource
]
