import { useI18n } from 'vue-i18n'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import NodeOutputsExportDialog from '@/platform/assets/components/NodeOutputsExportDialog.vue'
import { useAssetDownload } from '@/platform/assets/composables/useAssetDownload'
import { useAssetZipExport } from '@/platform/assets/composables/useAssetZipExport'
import type { DownloadableOutput } from '@/platform/assets/utils/outputExportUtil'
import {
  buildOutputsExportRequest,
  isDownloadableOutput,
  outputFileUrl
} from '@/platform/assets/utils/outputExportUtil'
import { useDialogService } from '@/services/dialogService'
import { useDialogStore } from '@/stores/dialogStore'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { getGridThumbnailUrl } from '@/utils/imageUtil'

const EXPORT_DIALOG_KEY = 'node-outputs-export'

export function useNodeOutputsExport() {
  const { t } = useI18n()
  const { flags } = useFeatureFlags()
  const nodeOutputStore = useNodeOutputStore()
  const dialogService = useDialogService()
  const dialogStore = useDialogStore()
  const { downloadFiles } = useAssetDownload()
  const { startZipExport } = useAssetZipExport()

  function getDownloadableOutputs(node: LGraphNode): DownloadableOutput[] {
    return (nodeOutputStore.getNodeOutputs(node)?.images ?? []).filter(
      isDownloadableOutput
    )
  }

  function hasMultipleOutputs(node: LGraphNode): boolean {
    return getDownloadableOutputs(node).length > 1
  }

  function closeExportDialog() {
    dialogStore.closeDialog({ key: EXPORT_DIALOG_KEY })
  }

  function showOutputsExportDialog(node: LGraphNode): void {
    const outputs = getDownloadableOutputs(node)
    if (outputs.length === 0) return

    dialogService.showSmallLayoutDialog({
      key: EXPORT_DIALOG_KEY,
      title: t('nodeOutputsExport.title'),
      component: NodeOutputsExportDialog,
      props: {
        items: outputs.map((output) => ({
          name: output.filename,
          thumbnailUrl: getGridThumbnailUrl(outputFileUrl(output))
        })),
        onCancel: closeExportDialog,
        onExport: (selectedIndices: number[]) => {
          closeExportDialog()
          void exportOutputs(selectedIndices.map((index) => outputs[index]))
        }
      },
      dialogComponentProps: { headerClass: 'px-4 py-3' }
    })
  }

  async function exportOutputs(outputs: DownloadableOutput[]): Promise<void> {
    const request =
      outputs.length > 1 && flags.assetsEnabled
        ? buildOutputsExportRequest(outputs)
        : undefined
    if (request) {
      await startZipExport(request, outputs.length)
      return
    }

    await downloadFiles(
      outputs.map((output) => ({
        mode: 'direct',
        url: outputFileUrl(output),
        filename: output.filename
      }))
    )
  }

  return { hasMultipleOutputs, showOutputsExportDialog }
}
