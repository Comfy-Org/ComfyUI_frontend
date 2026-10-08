import { normalizeLightsValue } from '@/extensions/core/lightInfo/lightsValue'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import type { InputSpec as InputSpecV2 } from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { ComfyWidgetConstructorV2 } from '@/scripts/widgets'

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
