/**
 * Module augmentation that extends the public ExtensionManager interface
 * with internal properties exposed by the WorkspaceStore.
 *
 * This augmentation is scoped to browser_tests (via browser_tests/tsconfig.json)
 * and allows tests to access store internals without type casts.
 */
import type { useColorPaletteService } from '@/services/colorPaletteService'
import type { useQueueSettingsStore } from '@/stores/queueStore'
import type { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'

declare module '@/types/extensionTypes' {
  interface ExtensionManager {
    workflow: ReturnType<typeof useWorkflowStore>
    queueSettings: ReturnType<typeof useQueueSettingsStore>
    colorPalette: ReturnType<typeof useColorPaletteService>
    focusMode: boolean
  }
}
