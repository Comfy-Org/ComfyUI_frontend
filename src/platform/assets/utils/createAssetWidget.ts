import { fromZodError } from 'zod-validation-error'

import { t } from '@/i18n'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type {
  IBaseWidget,
  IWidgetAssetOptions
} from '@/lib/litegraph/src/types/widgets'
import { useAssetBrowserDialog } from '@/platform/assets/composables/useAssetBrowserDialog'
import {
  assetFilenameSchema,
  assetItemSchema
} from '@/platform/assets/schemas/assetSchema'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { getAssetFilename } from '@/platform/assets/utils/assetMetadataUtils'

type WidgetWithNode = IBaseWidget & { node: LGraphNode }

interface CreateAssetWidgetParams {
  /** The node to add the widget to */
  node: LGraphNode
  /** The widget name */
  widgetName: string
  /** The node type to show in asset browser (may differ from node.comfyClass for PrimitiveNode) */
  nodeTypeForBrowser: string
  /** Input name for asset browser filtering (defaults to widgetName if not provided) */
  inputNameForBrowser?: string
  /** Default value for the widget */
  defaultValue?: string
}

interface CreateAssetWidgetOptionsParams {
  widgetName: string
  nodeTypeForBrowser: string
  inputNameForBrowser?: string
}

function hasOwnerNode(widget: IBaseWidget): widget is WidgetWithNode {
  return (
    'node' in widget && typeof widget.node === 'object' && widget.node !== null
  )
}

function createAssetWidgetOptions({
  widgetName,
  nodeTypeForBrowser,
  inputNameForBrowser
}: CreateAssetWidgetOptionsParams): IWidgetAssetOptions {
  const inputName = inputNameForBrowser ?? widgetName
  const assetBrowserDialog = useAssetBrowserDialog()

  async function openModal(widget: IBaseWidget) {
    const toastStore = useToastStore()

    await assetBrowserDialog.show({
      nodeType: nodeTypeForBrowser,
      inputName,
      currentValue: String(widget.value ?? ''),
      onAssetSelected: (asset) => {
        const validatedAsset = assetItemSchema.safeParse(asset)

        if (!validatedAsset.success) {
          console.error(
            'Invalid asset item:',
            fromZodError(validatedAsset.error).message
          )
          toastStore.add({
            severity: 'error',
            summary: t('assetBrowser.invalidAsset'),
            detail: t('assetBrowser.invalidAssetDetail')
          })
          return
        }

        const filename = getAssetFilename(validatedAsset.data)
        const validatedFilename = assetFilenameSchema.safeParse(filename)

        if (!validatedFilename.success) {
          console.error(
            'Invalid asset filename:',
            validatedFilename.error.errors,
            'for asset:',
            validatedAsset.data.id
          )
          toastStore.add({
            severity: 'error',
            summary: t('assetBrowser.invalidFilename'),
            detail: t('assetBrowser.invalidFilenameDetail')
          })
          return
        }

        const oldValue = widget.value
        widget.value = validatedFilename.data
        widget.callback?.(widget.value)
        if (hasOwnerNode(widget)) {
          widget.node.onWidgetChanged?.(
            widget.name,
            validatedFilename.data,
            oldValue,
            widget
          )
        }
        if (oldValue !== validatedFilename.data) {
          useWorkflowStore().activeWorkflow?.changeTracker?.captureCanvasState()
        }
      }
    })
  }

  return {
    openModal,
    nodeType: nodeTypeForBrowser
  }
}

export function createAssetWidget(
  params: CreateAssetWidgetParams
): IBaseWidget {
  const {
    node,
    widgetName,
    nodeTypeForBrowser,
    inputNameForBrowser,
    defaultValue
  } = params

  const displayLabel = defaultValue ?? t('widgets.selectModel')
  const options = createAssetWidgetOptions({
    widgetName,
    nodeTypeForBrowser,
    inputNameForBrowser
  })
  return node.addWidget('asset', widgetName, displayLabel, () => {}, options)
}
