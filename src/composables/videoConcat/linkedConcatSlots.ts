import type { ConcatClipSlot } from '@/composables/videoConcat/videoConcatOrder'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useLinkStore } from '@/stores/linkStore'
import { graphScopeOf } from '@/types/graphScopeId'

interface LinkedSlot extends ConcatClipSlot {
  inputName: string
}

export function linkedConcatSlots(
  node: LGraphNode,
  source: string
): LinkedSlot[] {
  const graph = node.graph
  if (!graph) return []
  const linkStore = useLinkStore()
  const scope = graphScopeOf(graph)
  const prefix = `${source}.`
  return node.inputs.flatMap((input, slot) => {
    if (!input.name.startsWith(prefix)) return []
    const link = linkStore.getInputSlotLink(scope, node.id, slot)
    if (!link) return []
    return [
      {
        name: input.name.slice(prefix.length),
        linkId: link.id,
        inputName: input.name
      }
    ]
  })
}
