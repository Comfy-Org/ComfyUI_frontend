import { expect, it, vi } from 'vitest'

import type {
  LGraph,
  LGraphCanvas,
  LGraphNode
} from '@/lib/litegraph/src/litegraph'
import { createNodeLocatorId } from '@/types/nodeIdentification'
import { toNodeId } from '@/types/nodeId'

import type { NodeProgressCanvasSync } from './nodeProgressCanvasSync'
import { createNodeProgressCanvasSync } from './nodeProgressCanvasSync'

type ProgressStates = Parameters<NodeProgressCanvasSync['sync']>[0]

function runningState(id: string, value: number) {
  return {
    display_node_id: id,
    node_id: id,
    prompt_id: 'job',
    state: 'running' as const,
    value,
    max: 100
  }
}

it('builds once, skips equal state, and looks up only the changed locator', () => {
  const writes = Array.from({ length: 1_000 }, () => vi.fn())
  const nodes = writes.map((write, index) => {
    let progress: number | undefined
    return {
      id: toNodeId(index + 1),
      get progress() {
        return progress
      },
      set progress(value: number | undefined) {
        write(value)
        progress = value
      }
    } as unknown as LGraphNode
  })
  const graph = {
    nodes,
    events: new EventTarget()
  } as unknown as LGraph
  const setDirty = vi.fn()
  const canvas = { setDirty } as unknown as LGraphCanvas
  const conversions = vi.fn((node: LGraphNode) =>
    createNodeLocatorId(null, node.id)
  )
  const lookups = vi.fn()
  const sync = createNodeProgressCanvasSync(conversions, lookups)
  const locator = createNodeLocatorId(null, toNodeId(1))
  const initial = { [locator]: runningState('1', 25) } satisfies ProgressStates

  sync.sync(initial, canvas, graph)
  expect(conversions).toHaveBeenCalledTimes(1_000)

  conversions.mockClear()
  lookups.mockClear()
  setDirty.mockClear()
  writes.forEach((write) => write.mockClear())

  sync.sync({ ...initial }, canvas, graph)
  expect(conversions).not.toHaveBeenCalled()
  expect(lookups).not.toHaveBeenCalled()
  expect(writes.every((write) => !write.mock.calls.length)).toBe(true)
  expect(setDirty).not.toHaveBeenCalled()

  sync.sync({ [locator]: runningState('1', 50) }, canvas, graph)
  expect(conversions).not.toHaveBeenCalled()
  expect(lookups).toHaveBeenCalledOnce()
  expect(writes[0]).toHaveBeenCalledExactlyOnceWith(0.5)
  expect(writes.slice(1).every((write) => !write.mock.calls.length)).toBe(true)
  expect(setDirty).toHaveBeenCalledExactlyOnceWith(true, false)
})
