import { describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'

import { toNodeId } from '@/types/nodeId'

import { canvasNodeTarget } from './canvasCoachTarget'

const state = vi.hoisted(() => ({
  camera: null as Record<string, number> | null
}))
vi.mock('@/renderer/core/layout/transform/useTransformState', async () => {
  const { reactive } = await import('vue')
  state.camera = reactive({ x: 0, y: 0, z: 1 })
  return { useTransformState: () => ({ camera: state.camera }) }
})

describe('canvasNodeTarget', () => {
  it.for([toNodeId(12), toNodeId('sub:7'), toNodeId('3d')])(
    'finds the node Nodes 2.0 rendered for id %s',
    (nodeId) => {
      const node = document.createElement('div')
      node.setAttribute('data-node-id', nodeId)
      document.body.append(node)

      expect(
        document.querySelector(canvasNodeTarget(nodeId).selector),
        'a node id reaches the DOM verbatim, so the selector has to survive it'
      ).toBe(node)
      node.remove()
    }
  )

  it('reports the camera moving, which fires no scroll or resize event', async () => {
    const scope = effectScope()
    const notify = vi.fn()
    scope.run(() => canvasNodeTarget(toNodeId(1)).onMove(notify))

    state.camera!.x = 250
    await nextTick()

    expect(
      notify,
      'a node the camera carries moves with nothing to announce it'
    ).toHaveBeenCalled()
    scope.stop()
  })
})
