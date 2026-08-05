import WorkflowTemplateSelectorDialog from '@/components/custom/widget/WorkflowTemplateSelectorDialog.vue'
import { useAppMode } from '@/composables/useAppMode'
import { useTelemetry } from '@/platform/telemetry'
import type { TemplateLibraryMetadata } from '@/platform/telemetry/types'
import { useDialogService } from '@/services/dialogService'
import { useNewUserService } from '@/services/useNewUserService'
import { useDialogStore } from '@/stores/dialogStore'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'
import { useTemplatesPanelStore } from '@/stores/workspace/templatesPanelStore'

const DIALOG_KEY = 'global-workflow-template-selector'
const GETTING_STARTED_CATEGORY_ID = 'basics-getting-started'
const TEMPLATES_TAB_ID = 'templates'

/**
 * Opens the template browser. The browser now lives in the docked sidebar
 * panel (TemplatesSidebarTab); this composable keeps the old modal-era API so
 * every entry point (menu, commands, welcome screens) works unchanged. Builder
 * mode has no sidebar panel, so it falls back to the original modal there.
 */
export const useWorkflowTemplateSelectorDialog = () => {
  const dialogService = useDialogService()
  const dialogStore = useDialogStore()
  const sidebarTabStore = useSidebarTabStore()
  const templatesPanelStore = useTemplatesPanelStore()
  const newUserService = useNewUserService()

  function hide() {
    dialogStore.closeDialog({ key: DIALOG_KEY })
    if (sidebarTabStore.activeSidebarTabId === TEMPLATES_TAB_ID) {
      sidebarTabStore.toggleSidebarTab(TEMPLATES_TAB_ID)
    }
  }

  function show(
    source: TemplateLibraryMetadata['source'] = 'command',
    options?: { initialCategory?: string; afterClose?: () => void }
  ) {
    const { isBuilderMode } = useAppMode()
    if (!isBuilderMode.value) {
      // Panel path: stash the open context (category deep-link, close
      // callback, telemetry source) and activate the sidebar tab. The panel
      // component emits opened/closed telemetry itself.
      templatesPanelStore.setOpenContext(source, options)
      if (sidebarTabStore.activeSidebarTabId !== TEMPLATES_TAB_ID) {
        sidebarTabStore.toggleSidebarTab(TEMPLATES_TAB_ID)
      }
      return
    }

    useTelemetry()?.trackTemplateLibraryOpened({ source })

    const initialCategory =
      options?.initialCategory ??
      (newUserService.isNewUser() ? GETTING_STARTED_CATEGORY_ID : 'all')

    dialogService.showLayoutDialog({
      key: DIALOG_KEY,
      component: WorkflowTemplateSelectorDialog,
      props: {
        onClose: () => {
          hide()
          options?.afterClose?.()
        },
        initialCategory
      },
      // The template browser is a wide layout. Without an explicit size the
      // Reka DialogContent falls back to size 'md' (max-w-xl), clipping the
      // filter bar so the Clear Filters button lands outside the viewport.
      // Size it like the other large dialogs (Settings/Manager).
      dialogComponentProps: {
        size: 'full',
        contentClass:
          'w-[90vw] max-w-[1400px] sm:max-w-[1400px] h-[80vh] rounded-2xl overflow-hidden'
      }
    })
  }

  return {
    show,
    hide
  }
}
