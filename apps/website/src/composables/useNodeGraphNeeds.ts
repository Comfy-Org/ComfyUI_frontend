import { useMounted } from '@vueuse/core'
import type { MaybeRefOrGetter } from 'vue'
import { ref, toValue, watch } from 'vue'

import type { NodeGraphInput } from '@/lib/hub/node-graph-inputs'
import {
  nodeGraphCustomNodes,
  nodeGraphInputs
} from '@/lib/hub/node-graph-inputs'

/** What the graph says a reader needs, or that it could not be read. */
export type NodeGraphNeeds =
  | { readonly status: 'loading' }
  | { readonly status: 'failed' }
  | {
      readonly status: 'read'
      readonly inputs: readonly NodeGraphInput[]
      readonly customNodes: readonly string[]
    }

const READ_TIMEOUT_MS = 15_000
const EMPTY: NodeGraphNeeds = { status: 'read', inputs: [], customNodes: [] }

async function readNeeds(
  source: string,
  signal: AbortSignal
): Promise<NodeGraphNeeds> {
  try {
    const response = await fetch(source, {
      signal: AbortSignal.any([signal, AbortSignal.timeout(READ_TIMEOUT_MS)])
    })
    if (!response.ok) return { status: 'failed' }
    const graph: unknown = await response.json()
    return {
      status: 'read',
      inputs: nodeGraphInputs(graph),
      customNodes: nodeGraphCustomNodes(graph)
    }
  } catch {
    return { status: 'failed' }
  }
}

/** Reads the graph at `source` in the browser, once the page has mounted. */
export function useNodeGraphNeeds(
  source: MaybeRefOrGetter<string | undefined>
) {
  const mounted = useMounted()
  const needs = ref<NodeGraphNeeds>({ status: 'loading' })
  watch(
    [mounted, () => toValue(source)] as const,
    async ([isMounted, current], _previous, onCleanup) => {
      if (!isMounted) return
      if (!current) {
        needs.value = EMPTY
        return
      }
      const controller = new AbortController()
      onCleanup(() => controller.abort())
      needs.value = { status: 'loading' }
      const read = await readNeeds(current, controller.signal)
      if (!controller.signal.aborted) needs.value = read
    },
    { immediate: true }
  )
  return needs
}
