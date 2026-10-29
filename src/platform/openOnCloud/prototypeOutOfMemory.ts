import type { ExecutionErrorWsMessage } from '@/platform/remote/comfyui/execution/types'

interface FailingNode {
  id: string | number
  type?: string
}

const OUT_OF_MEMORY_MESSAGE =
  'Allocation on device \nThis error means you ran out of memory on your GPU.\n\nTIPS: If the workflow worked before you might have accidentally set the batch_size to a large number.'

/** ComfyUI's out-of-memory execution error on the first sampler, else the last node. */
export function prototypeOutOfMemoryError(
  nodes: readonly FailingNode[],
  now: number
): ExecutionErrorWsMessage | null {
  const node =
    nodes.find((candidate) => candidate.type?.includes('Sampler')) ??
    nodes.at(-1)
  if (!node) return null
  return {
    prompt_id: `prototype-out-of-memory-${now}`,
    timestamp: now,
    node_id: String(node.id),
    node_type: node.type ?? '',
    executed: [],
    exception_type: 'torch.OutOfMemoryError',
    exception_message: OUT_OF_MEMORY_MESSAGE,
    traceback: []
  }
}
