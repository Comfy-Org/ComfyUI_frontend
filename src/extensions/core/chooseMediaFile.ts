import { getMediaSelectionLimits } from '@comfyorg/object-info-parser'
import type { MediaSelectionLimits } from '@comfyorg/object-info-parser'
import { isComboInputSpec } from '@comfyorg/object-info-parser/schemas/nodeDefSchemaV2'
import type { IBaseWidget } from '@comfyorg/graph-model/widgets'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { appendToMediaSelection } from '@/utils/mediaUploadUtil'

/** Selection counts for `widget` when its input is a list-valued upload picker. */
export function getWidgetSelectionLimits(
  node: LGraphNode,
  widget: IBaseWidget
): MediaSelectionLimits | undefined {
  const spec = useNodeDefStore().fromLGraphNode(node)?.inputs[widget.name]
  return spec && isComboInputSpec(spec)
    ? getMediaSelectionLimits(spec)
    : undefined
}

/** Sets `widget` to the chosen `path`, appending it to a list-valued picker's selection within its `max`, and returns the new value. */
export function chooseMediaFile(
  node: LGraphNode,
  widget: IBaseWidget,
  path: string
): string | string[] {
  const limits = getWidgetSelectionLimits(node, widget)
  const value = limits
    ? appendToMediaSelection(widget.value, [path], limits.max)
    : path
  widget.value = value
  return value
}
