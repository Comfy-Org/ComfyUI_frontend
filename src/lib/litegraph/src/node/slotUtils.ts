import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type {
  IWidgetInputSlot,
  SharedIntersection
} from '@/lib/litegraph/src/interfaces'
import type {
  INodeInputSlot,
  INodeOutputSlot,
  INodeSlot,
  IWidget
} from '@/lib/litegraph/src/litegraph'
import { outputLinkIds } from '@/lib/litegraph/src/node/slotLinks'
import type {
  ISerialisableNodeInput,
  ISerialisableNodeOutput
} from '@/lib/litegraph/src/types/serialisation'

type CommonIoSlotProps = SharedIntersection<
  ISerialisableNodeInput,
  ISerialisableNodeOutput
>

function shallowCloneCommonProps(slot: CommonIoSlotProps): CommonIoSlotProps {
  const {
    color_off,
    color_on,
    dir,
    label,
    localized_name,
    locked,
    name,
    nameLocked,
    removable,
    shape,
    type
  } = slot
  return {
    color_off,
    color_on,
    dir,
    label,
    localized_name,
    locked,
    name,
    nameLocked,
    removable,
    shape,
    type
  }
}

export function inputAsSerialisable(
  slot: INodeInputSlot
): ISerialisableNodeInput {
  const { link } = slot
  const widgetOrPos = slot.widget
    ? { widget: { name: slot.widget.name } }
    : { pos: slot.pos }

  return {
    ...shallowCloneCommonProps(slot),
    ...widgetOrPos,
    link
  }
}

export function outputAsSerialisable(
  slot: INodeOutputSlot & { widget?: IWidget },
  node: LGraphNode,
  slotIndex: number
): ISerialisableNodeOutput {
  const { pos, slot_index, widget } = slot
  // Output widgets do not exist in Litegraph; this is a temporary downstream workaround.
  const outputWidget = widget ? { widget: { name: widget.name } } : null
  const ids = node.graph ? outputLinkIds(node.graph, node.id, slotIndex) : []

  return {
    ...shallowCloneCommonProps(slot),
    ...outputWidget,
    pos,
    slot_index,
    links: ids.length ? ids : null
  }
}

export function isINodeInputSlot(slot: INodeSlot): slot is INodeInputSlot {
  return 'link' in slot
}

/**
 * Type guard: Whether this input slot is attached to a widget.
 * @param slot The slot to check.
 */

export function isWidgetInputSlot(
  slot: INodeInputSlot
): slot is IWidgetInputSlot {
  return !!slot.widget
}
