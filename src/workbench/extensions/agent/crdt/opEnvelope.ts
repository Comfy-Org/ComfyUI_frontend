import { BATCHABLE_OPS } from '@comfyorg/comfy-multi-player'
import type { Actor, Op } from '@comfyorg/comfy-multi-player'

import { createUuidv4 } from '@/utils/uuid'

import type { GraphOperation } from './graphOperations'

export function mintWireOps(
  operations: GraphOperation[],
  { actor, baseVersion }: { actor: Actor; baseVersion: number }
): Op[] {
  return operations.map((operation) => ({
    ...operation,
    op_id: createUuidv4().replaceAll('-', ''),
    actor,
    base_version: baseVersion,
    stamp: [baseVersion, actor]
  }))
}

export function chunkWireOps<T extends { op: Op; bytes: number }>(
  ops: readonly T[]
): T[][] {
  const batches: T[][] = []
  let current: T[] = []
  let currentBytes = 0

  const flush = (): void => {
    if (current.length > 0) batches.push(current)
    current = []
    currentBytes = 0
  }

  for (const sized of ops) {
    if (!BATCHABLE_OPS.some((kind) => kind === sized.op.op)) {
      flush()
      batches.push([sized])
      continue
    }
    const overOps = current.length + 1 > 256
    const overBytes =
      current.length > 0 && currentBytes + sized.bytes > 4 * 1024 * 1024
    if (overOps || overBytes) flush()
    current.push(sized)
    currentBytes += sized.bytes
  }
  flush()
  return batches
}
