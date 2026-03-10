import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'

const testState = vi.hoisted(() => {
  return {
    listener: null as ((change: { nodeIds: string[] }) => void) | null,
    layoutByNodeId: new Map<
      string,
      {
        position: { x: number; y: number }
        size: { width: number; height: number }
      }
    >(),
    unsubscribe: vi.fn(),
    rafCallback: null as FrameRequestCallback | null
  }
})

vi.mock('@/renderer/core/layout/store/layoutStore', () => ({
  layoutStore: {
    onChange: vi.fn((callback: (change: { nodeIds: string[] }) => void) => {
      testState.listener = callback
      return testState.unsubscribe
    }),
    getNodeLayoutRef: vi.fn((nodeId: string) => ({
      value: testState.layoutByNodeId.get(nodeId) ?? null
    }))
  }
}))

import { useLayoutSync } from '@/renderer/core/layout/sync/useLayoutSync'

describe('useLayoutSync', () => {
  beforeEach(() => {
    testState.listener = null
    testState.layoutByNodeId.clear()
    testState.unsubscribe.mockReset()
    testState.rafCallback = null

    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      testState.rafCallback = cb
      return 1
    })
  })

  it('coalesces multiple change events into one flush per frame', () => {
    const liteNode = {
      pos: [0, 0],
      size: [100, 50],
      onResize: vi.fn()
    }
    const canvas = {
      graph: {
        getNodeById: vi.fn(() => liteNode)
      },
      setDirty: vi.fn()
    }

    testState.layoutByNodeId.set('1', {
      position: { x: 10, y: 15 },
      size: { width: 120, height: 70 }
    })

    const wrapper = mount(
      defineComponent({
        setup() {
          return useLayoutSync()
        },
        template: '<div />'
      })
    )

    wrapper.vm.startSync(canvas as never)

    testState.listener?.({ nodeIds: ['1'] })
    testState.listener?.({ nodeIds: ['1'] })

    expect(canvas.setDirty).not.toHaveBeenCalled()

    testState.rafCallback?.(0)

    expect(canvas.setDirty).toHaveBeenCalledTimes(1)
    expect(canvas.graph.getNodeById).toHaveBeenCalledTimes(1)
    expect(liteNode.pos).toEqual([10, 15])
    expect(liteNode.size).toEqual([120, 70])

    wrapper.unmount()
  })
})
