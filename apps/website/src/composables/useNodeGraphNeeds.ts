import type { MaybeRefOrGetter } from 'vue'
import { ref, toValue, watch } from 'vue'

import type { NodeGraphInput } from '@/lib/hub/node-graph-inputs'
import {
  nodeGraphCustomNodes,
  nodeGraphInputs
} from '@/lib/hub/node-graph-inputs'

interface NodeGraphNeeds {
  readonly inputs: readonly NodeGraphInput[]
  readonly customNodes: readonly string[]
}

const NOTHING: NodeGraphNeeds = { inputs: [], customNodes: [] }

async function readNeeds(source: string): Promise<NodeGraphNeeds> {
  try {
    const response = await fetch(source)
    if (!response.ok) return NOTHING
    const graph: unknown = await response.json()
    return {
      inputs: nodeGraphInputs(graph),
      customNodes: nodeGraphCustomNodes(graph)
    }
  } catch {
    return NOTHING
  }
}

/** The inputs and custom node packs of the graph at `source`; undefined while it loads. */
export function useNodeGraphNeeds(
  source: MaybeRefOrGetter<string | undefined>
) {
  const needs = ref<NodeGraphNeeds>()
  let latest = 0
  watch(
    () => toValue(source),
    async (current) => {
      const request = ++latest
      needs.value = current ? undefined : NOTHING
      if (!current) return
      const read = await readNeeds(current)
      if (request === latest) needs.value = read
    },
    { immediate: true }
  )
  return needs
}
