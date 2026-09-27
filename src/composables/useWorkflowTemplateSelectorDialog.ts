import WorkflowTemplateSelectorDialog from '@/components/custom/widget/WorkflowTemplateSelectorDialog.vue'
import { useTelemetry } from '@/platform/telemetry'
import type {
  TemplateLibraryClosedMetadata,
  TemplateLibraryMetadata
} from '@/platform/telemetry/types'
import { useDialogService } from '@/services/dialogService'
import { useNewUserService } from '@/services/useNewUserService'
import { useDialogStore } from '@/stores/dialogStore'

const DIALOG_KEY = 'global-workflow-template-selector'
const POPULAR_CATEGORY_ID = 'popular'

type CloseMethod = TemplateLibraryClosedMetadata['close_method']

interface OpenSession {
  openedAt: number
  templateSelected: boolean
  closeMethod?: CloseMethod
  emitted: boolean
}

let openSession: OpenSession | undefined

export const useWorkflowTemplateSelectorDialog = () => {
  const dialogService = useDialogService()
  const dialogStore = useDialogStore()
  const newUserService = useNewUserService()

  function close(method: CloseMethod) {
    if (openSession) openSession.closeMethod = method
    dialogStore.closeDialog({ key: DIALOG_KEY })
  }

  function hide() {
    close('programmatic')
  }

  function show(
    source: TemplateLibraryMetadata['source'] = 'command',
    options?: { initialCategory?: string; afterClose?: () => void }
  ) {
    useTelemetry()?.trackTemplateLibraryOpened({ source })

    const session: OpenSession = {
      openedAt: Date.now(),
      templateSelected: false,
      emitted: false
    }
    openSession = session

    const initialCategory =
      options?.initialCategory ??
      (newUserService.isNewUser() ? POPULAR_CATEGORY_ID : 'all')

    dialogService.showLayoutDialog({
      key: DIALOG_KEY,
      component: WorkflowTemplateSelectorDialog,
      props: {
        onClose: () => {
          close('in_dialog')
          options?.afterClose?.()
        },
        onTemplateSelected: (selected: boolean) => {
          session.templateSelected = selected
          session.closeMethod = selected ? 'in_dialog' : undefined
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
          'w-[90vw] max-w-[1400px] sm:max-w-[1400px] h-[80vh] rounded-2xl overflow-hidden',
        onRemoved: () => {
          if (session.emitted) return
          session.emitted = true
          useTelemetry()?.trackTemplateLibraryClosed({
            template_selected: session.templateSelected,
            time_spent_seconds: Math.floor(
              (Date.now() - session.openedAt) / 1000
            ),
            close_method:
              session.closeMethod ??
              (dialogStore.dialogStack.length >= 10 ? 'evicted' : 'dismissed')
          })
          if (openSession === session) openSession = undefined
        }
      }
    })
  }

  return {
    show,
    hide
  }
}
