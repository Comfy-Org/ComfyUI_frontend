import type {
  SubgraphInput,
  SubgraphInputNode
} from '@comfyorg/graph-model/entityRegistry'
import type { SubgraphIO } from '@comfyorg/graph-model/serialisation'
import { widgetId } from '@comfyorg/graph-model/widgetId'
import type { WidgetId } from '@comfyorg/graph-model/widgetId'
import { useWidgetHeightStore } from '@/stores/widgetHeightStore'

function heightId(inputNode: SubgraphInputNode, inputId: string): WidgetId {
  return widgetId(inputNode.subgraph.id, inputNode.id, inputId)
}

/** The widget height store key for the widget a subgraph input shows in the input panel. */
export function subgraphInputHeightId(input: SubgraphInput): WidgetId {
  return heightId(input.parent, input.id)
}

/** The input panel widget height of `input`, as serialised on its definition. */
export function serialisedSubgraphInputHeight(
  input: SubgraphInput
): Pick<SubgraphIO, 'widgetHeight'> {
  const height = useWidgetHeightStore().get(subgraphInputHeightId(input))
  return height ? { widgetHeight: height.height } : {}
}

/** Replaces the input panel widget heights of `inputNode` with those serialised on `inputs`. */
export function adoptSubgraphInputHeights(
  inputNode: SubgraphInputNode,
  inputs: readonly SubgraphIO[]
): void {
  const store = useWidgetHeightStore()
  store.clearNode(inputNode.subgraph.id, inputNode.id)
  for (const { id, widgetHeight } of inputs) {
    if (
      typeof widgetHeight === 'number' &&
      Number.isFinite(widgetHeight) &&
      widgetHeight > 0
    )
      store.set(heightId(inputNode, id), { height: Math.round(widgetHeight) })
  }
}
