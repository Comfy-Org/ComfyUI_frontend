import TemplateDetailDialog from '@/components/templates/TemplateDetailDialog.vue'
import type { TemplateInfo } from '@/platform/workflow/templates/types/template'
import { useDialogService } from '@/services/dialogService'

const DIALOG_KEY_PREFIX = 'template-detail-'

/**
 * Opens the template detail view: media plus the decision-relevant metadata
 * (description, models, sizes, custom nodes) with the load action, so choosing
 * a template no longer requires loading it first.
 */
export const useTemplateDetailDialog = () => {
  const dialogService = useDialogService()

  function show(options: {
    template: TemplateInfo
    sourceModule: string
    onUse: () => Promise<unknown> | unknown
  }) {
    // Key per template: dialogStore.showDialog reuses an existing entry (and
    // its stale props) when the key matches, so a shared key would show the
    // previously opened template.
    const dialogKey = `${DIALOG_KEY_PREFIX}${options.template.name}`
    dialogService.showLayoutDialog({
      key: dialogKey,
      component: TemplateDetailDialog,
      props: {
        template: options.template,
        sourceModule: options.sourceModule,
        dialogKey,
        onUse: options.onUse
      },
      dialogComponentProps: {
        contentClass:
          'w-[92vw] max-w-[1120px] sm:max-w-[1120px] rounded-2xl overflow-hidden p-0'
      }
    })
  }

  return { show }
}
