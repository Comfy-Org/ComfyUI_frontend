import { normalizeLightsValue } from '@comfyorg/viewport3d/lightInfo/lightsValue'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@comfyorg/graph-model/widgets'
import type { InputSpec as InputSpecV2 } from '@comfyorg/object-info-parser/schemas/nodeDefSchemaV2'
import type { ComfyWidgetConstructorV2 } from '@/types/widgetConstructor'

export const useLightInfoWidget = (): ComfyWidgetConstructorV2 => {
  return (node: LGraphNode, inputSpec: InputSpecV2): IBaseWidget => {
    return node.addWidget(
      'lightinfo',
      inputSpec.name,
      normalizeLightsValue(inputSpec.default),
      null,
      { serialize: true, hideInPanel: true }
    )
  }
}
