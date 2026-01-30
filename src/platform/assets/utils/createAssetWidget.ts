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
import { getAssetFilename } from '@/platform/assets/utils/assetMetadataUtils'

interface CreateAssetWidgetParams {
  /** The node to add the widget to */
  node: LGraphNode
  /** The widget name */
  widgetName: string
  /** The node type to show in asset browser (may differ from node.comfyClass for PrimitiveNode) */
  nodeTypeForBrowser: string
  /** Default value for the widget */
  defaultValue?: string
  /** Callback when widget value changes */
  onValueChange?: (
    widget: IBaseWidget,
    newValue: string,
    oldValue: unknown
  ) => void
}

/**
 * Creates an asset widget that opens the Asset Browser dialog for model selection.
 * Used by both regular nodes (via useComboWidget) and PrimitiveNode.
 *
 * @param params - Configuration for the asset widget
 * @returns The created asset widget
 */
export function createAssetWidget(
  params: CreateAssetWidgetParams
): IBaseWidget {
  const { node, widgetName, nodeTypeForBrowser, defaultValue, onValueChange } =
    params

  const displayLabel = defaultValue ?? t('widgets.selectModel')
  const assetBrowserDialog = useAssetBrowserDialog()

  async function openModal(widget: IBaseWidget) {
    await assetBrowserDialog.show({
      nodeType: nodeTypeForBrowser,
      inputName: widgetName,
      currentValue: widget.value as string,
      onAssetSelected: (asset) => {
        const validatedAsset = assetItemSchema.safeParse(asset)

        if (!validatedAsset.success) {
          console.error(
            'Invalid asset item:',
            validatedAsset.error.errors,
            'Received:',
            asset
          )
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
          return
        }

        const oldValue = widget.value
        widget.value = validatedFilename.data
        onValueChange?.(widget, validatedFilename.data, oldValue)
      }
    })
  }

  const options: IWidgetAssetOptions = { openModal }

  return node.addWidget('asset', widgetName, displayLabel, () => {}, options)
}
