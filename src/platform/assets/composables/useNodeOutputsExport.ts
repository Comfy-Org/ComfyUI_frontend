import { useI18n } from 'vue-i18n'
import type { CreateAssetExportData } from '@comfyorg/ingest-types'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import NodeOutputsExportDialog from '@/platform/assets/components/NodeOutputsExportDialog.vue'
import { useAssetDownload } from '@/platform/assets/composables/useAssetDownload'
import { useAssetZipExport } from '@/platform/assets/composables/useAssetZipExport'
import { useDialogService } from '@/services/dialogService'
import { useDialogStore } from '@/stores/dialogStore'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { parseNodeOutput } from '@/stores/resultItemParsing'
import type { AugmentedResultItem } from '@/utils/resultItem'
import { resultItemPreviewUrl, resultItemUrl } from '@/utils/resultItemUrl'

const EXPORT_DIALOG_KEY = 'node-outputs-export'

function buildOutputsExportRequest(
  outputs: AugmentedResultItem[]
): CreateAssetExportData['body'] | undefined {
  const assetIds = outputs.map((output) => output.id)
  if (assetIds.length === 0 || !assetIds.every((id): id is string => !!id)) {
    return undefined
  }
  return { asset_ids: assetIds, naming_strategy: 'preserve' }
}

export function useNodeOutputsExport() {
  const { t } = useI18n()
  const { flags } = useFeatureFlags()
  const nodeOutputStore = useNodeOutputStore()
  const dialogService = useDialogService()
  const dialogStore = useDialogStore()
  const { downloadFiles } = useAssetDownload()
  const { startZipExport } = useAssetZipExport()

  function getDownloadableOutputs(node: LGraphNode): AugmentedResultItem[] {
    return parseNodeOutput(node.id, nodeOutputStore.getNodeOutputs(node))
  }

  function hasMultipleOutputs(node: LGraphNode): boolean {
    return getDownloadableOutputs(node).length > 1
  }

  function thumbnailUrl(output: AugmentedResultItem): string {
    return resultItemPreviewUrl(output)
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
          thumbnailUrl: thumbnailUrl(output)
        })),
        onCancel: closeExportDialog,
        onExport: (selectedIndices: number[]) => {
          closeExportDialog()
          void exportOutputs(selectedIndices.map((index) => outputs[index]))
        }
      }
    })
  }

  async function exportOutputs(outputs: AugmentedResultItem[]): Promise<void> {
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
        url: resultItemUrl(output),
        filename: output.filename
      }))
    )
  }

  return { hasMultipleOutputs, showOutputsExportDialog }
}
