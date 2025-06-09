import type { LGraphNode } from '@comfyorg/litegraph'
import type { IBaseWidget } from '@comfyorg/litegraph/dist/types/widgets'

import type { InputSpec as InputSpecV2 } from '@/schemas/nodeDef/nodeDefSchemaV2'

/**
 * Constructor function type for ComfyUI widgets using V2 input specification
 */
export type ComfyWidgetConstructorV2 = (
  node: LGraphNode,
  inputSpec: InputSpecV2
) => IBaseWidget
