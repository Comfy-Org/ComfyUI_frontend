import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type {
  IResolutionPreviewWidget,
  IWidgetResolutionPreviewOptions
} from '@/lib/litegraph/src/types/widgets'
import type {
  InputSpec as InputSpecV2,
  ResolutionPreviewInputSpec
} from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { ComfyWidgetConstructorV2 } from '@/scripts/widgets'

export const useResolutionPreviewWidget = (): ComfyWidgetConstructorV2 => {
  return (
    node: LGraphNode,
    inputSpec: InputSpecV2
  ): IResolutionPreviewWidget => {
    const spec = inputSpec as ResolutionPreviewInputSpec
    const options: IWidgetResolutionPreviewOptions = {
      serialize: false,
      canvasOnly: false,
      hideInPanel: true,
      ratio_widget: spec.ratio_widget,
      megapixels_widget: spec.megapixels_widget,
      multiple_widget: spec.multiple_widget
    }
    const rawWidget = node.addWidget(
      'resolutionpreview',
      spec.name,
      null,
      () => {},
      options
    )
    rawWidget.serialize = false

    return rawWidget as IResolutionPreviewWidget
  }
}
