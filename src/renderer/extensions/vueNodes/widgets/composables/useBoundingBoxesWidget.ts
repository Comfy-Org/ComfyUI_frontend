import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type {
  IBaseWidget,
  IWidgetBoundingBoxesOptions
} from '@comfyorg/graph-model/widgets'
import type {
  BoundingBoxesInputSpec,
  InputSpec as InputSpecV2
} from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { ComfyWidgetConstructorV2 } from '@/types/widgetConstructor'
import type { BoundingBox } from '@comfyorg/graph-model/boundingBoxes'

export const useBoundingBoxesWidget = (): ComfyWidgetConstructorV2 => {
  return (node: LGraphNode, inputSpec: InputSpecV2): IBaseWidget => {
    const spec = inputSpec as BoundingBoxesInputSpec
    const defaultValue: BoundingBox[] =
      spec.default?.map((box) => ({
        ...box,
        metadata: { ...box.metadata, palette: [...box.metadata.palette] }
      })) ?? []
    const options: IWidgetBoundingBoxesOptions = {
      serialize: true,
      hideInPanel: true,
      max_boxes: spec.max_boxes
    }
    return node.addWidget(
      'boundingboxes',
      spec.name,
      defaultValue,
      null,
      options
    )
  }
}
