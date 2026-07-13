import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { toNodeId } from '@/types/nodeId'

import type { PromptRole } from './tourSequence'

const subgraph = { id: 'sub-1' }

const canvasObj = {
  graph: { id: 'root' } as { id: string },
  openSubgraph: vi.fn(),
  setGraph: vi.fn(),
  setDirty: vi.fn()
}

const mocks = vi.hoisted(() => ({
  canvas: null as typeof canvasObj | null,
  rootGraph: { id: 'root', getNodeById: vi.fn() } as {
    id: string
    getNodeById: ReturnType<typeof vi.fn>
  }
}))

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({ canvas: mocks.canvas })
}))

vi.mock('@/scripts/app', () => ({
  app: {
    get rootGraph() {
      return mocks.rootGraph
    }
  }
}))

import { focusPromptTarget, restoreView } from './subgraphNavigation'

const target: PromptRole = {
  subgraphNodeId: toNodeId(10),
  innerNodeId: toNodeId(27),
  widgetName: 'text',
  portFallback: 'prompt'
}

function makeSubgraphNode() {
  return {
    isSubgraphNode: () => true,
    subgraph
  }
}

function mountInnerInput(): HTMLTextAreaElement {
  const host = document.createElement('div')
  host.setAttribute('data-node-id', String(target.innerNodeId))
  const input = document.createElement('textarea')
  host.append(input)
  document.body.append(host)
  return input
}

describe('subgraphNavigation', () => {
  beforeEach(() => {
    canvasObj.graph = { id: 'root' }
    canvasObj.openSubgraph.mockReset()
    canvasObj.setGraph.mockReset()
    mocks.canvas = canvasObj
    mocks.rootGraph.getNodeById.mockReset()
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0)
      return 0
    })
  })

  afterEach(() => {
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('enters the subgraph and focuses the inner widget input, returning true', async () => {
    mocks.rootGraph.getNodeById.mockReturnValue(makeSubgraphNode())
    const input = mountInnerInput()

    const ok = await focusPromptTarget(target)

    expect(ok).toBe(true)
    expect(canvasObj.openSubgraph).toHaveBeenCalledWith(
      subgraph,
      expect.anything()
    )
    expect(document.activeElement).toBe(input)
  })

  it('returns false when the subgraph node cannot be found', async () => {
    mocks.rootGraph.getNodeById.mockReturnValue(null)

    expect(await focusPromptTarget(target)).toBe(false)
    expect(canvasObj.openSubgraph).not.toHaveBeenCalled()
  })

  it('returns false when the target node is not a subgraph node', async () => {
    mocks.rootGraph.getNodeById.mockReturnValue({ isSubgraphNode: () => false })

    expect(await focusPromptTarget(target)).toBe(false)
    expect(canvasObj.openSubgraph).not.toHaveBeenCalled()
  })

  it('returns false when the inner widget input is absent (falls back to port)', async () => {
    mocks.rootGraph.getNodeById.mockReturnValue(makeSubgraphNode())

    expect(await focusPromptTarget(target)).toBe(false)
  })

  it('restoreView returns the canvas to the root graph', () => {
    mocks.rootGraph.getNodeById.mockReturnValue(makeSubgraphNode())

    restoreView()

    expect(canvasObj.setGraph).toHaveBeenCalledWith(mocks.rootGraph)
  })

  it('focusPromptTarget returns false without a canvas', async () => {
    mocks.canvas = null

    expect(await focusPromptTarget(target)).toBe(false)
  })

  it('restoreView does not throw without a canvas', () => {
    mocks.canvas = null

    expect(() => restoreView()).not.toThrow()
  })

  it('does not break out of the selector for a quote-bearing node id', async () => {
    const craftedTarget: PromptRole = {
      ...target,
      innerNodeId: toNodeId('27"], [data-node-id]')
    }
    mocks.rootGraph.getNodeById.mockReturnValue(makeSubgraphNode())

    // A decoy the injected selector `[data-node-id]` would have matched.
    const decoyHost = document.createElement('div')
    decoyHost.setAttribute('data-node-id', '99')
    const decoy = document.createElement('input')
    decoyHost.append(decoy)
    document.body.append(decoyHost)

    // Settles (never hangs/throws) and does not focus the decoy — the crafted
    // id is escaped, so it can't break the attribute matcher.
    expect(await focusPromptTarget(craftedTarget)).toBe(false)
    expect(document.activeElement).not.toBe(decoy)
  })

  it('returns false when entering the subgraph throws', async () => {
    mocks.rootGraph.getNodeById.mockReturnValue(makeSubgraphNode())
    canvasObj.openSubgraph.mockImplementation(() => {
      throw new Error('null graph')
    })

    expect(await focusPromptTarget(target)).toBe(false)
  })
})
