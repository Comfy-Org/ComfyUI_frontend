import type { LGraphNode } from '@comfyorg/litegraph/litegraph'
import type { IBaseWidget } from '@comfyorg/graph-model/widgets'
import type { InputSpec as InputSpecV2 } from '@comfyorg/graph-model/nodeDefSchemaV2'

export type ComfyWidgetConstructorV2 = (
  node: LGraphNode,
  inputSpec: InputSpecV2
) => IBaseWidget
