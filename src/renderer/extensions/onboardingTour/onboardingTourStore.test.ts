import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { toNodeId } from '@/types/nodeId'

const restoreView = vi.hoisted(() => vi.fn())
vi.mock('./subgraphNavigation', () => ({ restoreView }))

const resolveRoles = vi.hoisted(() => vi.fn())
vi.mock('./roleResolver', () => ({ resolveRoles }))

const sinkNode = vi.hoisted(() => ({}) as object)
const resolveNode = vi.hoisted(() => vi.fn())
vi.mock('@/utils/litegraphUtil', () => ({ resolveNode }))

const getNodeImageUrls = vi.hoisted(() => vi.fn())
vi.mock('@/stores/nodeOutputStore', () => ({
  useNodeOutputStore: () => ({ getNodeImageUrls })
}))

import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'

import { useOnboardingTourStore } from './onboardingTourStore'
import type { ResolvedRoles } from './tourSequence'

const workflow = {} as ComfyWorkflowJSON

const i2vRoles: ResolvedRoles = {
  source: { nodeId: toNodeId(97) },
  prompt: {
    subgraphNodeId: toNodeId(10),
    innerNodeId: toNodeId(93),
    widgetName: 'text',
    portFallback: 'prompt'
  },
  engine: { nodeId: toNodeId(86) },
  sink: { nodeId: toNodeId(108) },
  mediaKind: 'video'
}

const t2iRoles: ResolvedRoles = {
  source: null,
  prompt: {
    subgraphNodeId: toNodeId(10),
    innerNodeId: toNodeId(27),
    widgetName: 'text',
    portFallback: 'prompt'
  },
  engine: { nodeId: toNodeId(3) },
  sink: { nodeId: toNodeId(9) },
  mediaKind: 'image'
}

describe('onboardingTourStore', () => {
  let store: ReturnType<typeof useOnboardingTourStore>

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    store = useOnboardingTourStore()
    resolveRoles.mockReset()
    restoreView.mockReset()
    resolveNode.mockReset()
    getNodeImageUrls.mockReset()
    resolveNode.mockReturnValue(sinkNode)
    getNodeImageUrls.mockReturnValue(['blob:sink-output'])
  })

  it('reset() clears all state back to idle', () => {
    store.phase = 'active'
    store.stepIndex = 3
    store.resolvedRoles = {
      source: null,
      prompt: null,
      engine: null,
      sink: null,
      mediaKind: 'video'
    }
    store.revealedNodeIds.add(toNodeId(42))
    store.resultMedia = { url: 'blob:x', kind: 'image' }
    store.runStatus = 'running'
    store.nudgePending = true

    store.reset()

    expect(store.phase).toBe('idle')
    expect(store.stepIndex).toBe(0)
    expect(store.resolvedRoles).toBeNull()
    expect(store.revealedNodeIds.size).toBe(0)
    expect(store.resultMedia).toBeNull()
    expect(store.runStatus).toBe('idle')
    expect(store.nudgePending).toBe(false)
  })

  it('start() on I2V roles builds [Upload, Prompt, Run, Result] and reveals the source', () => {
    resolveRoles.mockReturnValue(i2vRoles)

    store.start(workflow)

    expect(resolveRoles).toHaveBeenCalledWith(workflow, undefined)
    expect(store.phase).toBe('active')
    expect(store.stepIndex).toBe(0)
    expect(store.steps.map((s) => s.kind)).toEqual([
      'upload',
      'prompt',
      'run',
      'result'
    ])
    expect([...store.revealedNodeIds]).toEqual([toNodeId(97)])
  })

  it('start() passes the templateId through to the resolver', () => {
    resolveRoles.mockReturnValue(t2iRoles)

    store.start(workflow, 'image_z_image_turbo')

    expect(resolveRoles).toHaveBeenCalledWith(workflow, 'image_z_image_turbo')
  })

  it('start() on T2I roles omits the Upload step', () => {
    resolveRoles.mockReturnValue(t2iRoles)

    store.start(workflow)

    expect(store.steps.map((s) => s.kind)).toEqual(['prompt', 'run', 'result'])
    // T2I opens on the prompt step, revealing its collapsed subgraph host.
    expect([...store.revealedNodeIds]).toEqual([toNodeId(10)])
  })

  it('advance() accumulates revealed nodes so the graph builds up', () => {
    resolveRoles.mockReturnValue(i2vRoles)
    store.start(workflow)

    store.advance() // → prompt (nodeId null, reveals the subgraph host)
    expect(store.stepIndex).toBe(1)
    expect([...store.revealedNodeIds]).toEqual([toNodeId(97), toNodeId(10)])

    store.advance() // → run (no node)
    expect([...store.revealedNodeIds]).toEqual([toNodeId(97), toNodeId(10)])

    store.advance() // → result (sink)
    expect([...store.revealedNodeIds]).toEqual([
      toNodeId(97),
      toNodeId(10),
      toNodeId(108)
    ])
  })

  it('advance() does not run past the last step', () => {
    resolveRoles.mockReturnValue(t2iRoles)
    store.start(workflow)

    store.advance()
    store.advance()
    store.advance()
    store.advance()

    expect(store.stepIndex).toBe(store.steps.length - 1)
  })

  it('back() restores the prior reveal set', () => {
    resolveRoles.mockReturnValue(i2vRoles)
    store.start(workflow)
    store.advance()

    store.back()

    expect(store.stepIndex).toBe(0)
    expect([...store.revealedNodeIds]).toEqual([toNodeId(97)])
  })

  it('back() does not run before the first step', () => {
    resolveRoles.mockReturnValue(t2iRoles)
    store.start(workflow)

    store.back()

    expect(store.stepIndex).toBe(0)
  })

  it('end() restores the view and resets to idle', () => {
    resolveRoles.mockReturnValue(i2vRoles)
    store.start(workflow)
    store.advance()

    store.end()

    expect(restoreView).toHaveBeenCalledOnce()
    expect(store.phase).toBe('idle')
    expect(store.stepIndex).toBe(0)
    expect(store.resolvedRoles).toBeNull()
    expect(store.steps).toEqual([])
    expect(store.revealedNodeIds.size).toBe(0)
  })

  it('degrades to a lone Run step when prompt and sink are unresolved', () => {
    resolveRoles.mockReturnValue({ ...t2iRoles, prompt: null, sink: null })

    store.start(workflow)

    // No prompt AND no sink → the machine still starts but degrades to the
    // always-present Run step rather than crashing.
    expect(store.steps.map((s) => s.kind)).toEqual(['run'])
    expect(store.phase).toBe('active')
  })

  it('captureResultMedia() records the sink output URL with the resolved media kind', () => {
    resolveRoles.mockReturnValue(i2vRoles)
    store.start(workflow)

    store.captureResultMedia()

    expect(resolveNode).toHaveBeenCalledWith(toNodeId(108))
    expect(getNodeImageUrls).toHaveBeenCalledWith(sinkNode)
    expect(store.resultMedia).toEqual({
      url: 'blob:sink-output',
      kind: 'video'
    })
    expect(store.runStatus).toBe('completed')
  })

  it('captureResultMedia() is a no-op while the tour is idle', () => {
    store.captureResultMedia()

    expect(resolveNode).not.toHaveBeenCalled()
    expect(store.resultMedia).toBeNull()
  })

  it('captureResultMedia() ignores a sink with no output', () => {
    resolveRoles.mockReturnValue(t2iRoles)
    store.start(workflow)
    getNodeImageUrls.mockReturnValue(undefined)

    store.captureResultMedia()

    expect(store.resultMedia).toBeNull()
    expect(store.runStatus).toBe('idle')
  })

  it('captureResultMedia() ignores an unresolvable sink node', () => {
    resolveRoles.mockReturnValue(t2iRoles)
    store.start(workflow)
    resolveNode.mockReturnValue(null)

    store.captureResultMedia()

    expect(getNodeImageUrls).not.toHaveBeenCalled()
    expect(store.resultMedia).toBeNull()
  })

  it('markNudgePending() flags the post-tour nudge and end() clears it', () => {
    resolveRoles.mockReturnValue(t2iRoles)
    store.start(workflow)

    store.markNudgePending()
    expect(store.nudgePending).toBe(true)

    store.end()
    expect(store.nudgePending).toBe(false)
  })
})
