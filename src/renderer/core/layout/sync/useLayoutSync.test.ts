import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'

import { LayoutSource } from '@/renderer/core/layout/types'

const testState = vi.hoisted(() => {
  return {
    listener: null as
      | ((change: { nodeIds: string[]; source: LayoutSource }) => void)
      | null,
    layoutByNodeId: new Map<
      string,
      {
        position: { x: number; y: number }
        size: { width: number; height: number }
      }
    >(),
    unsubscribe: vi.fn(),
    rafCallback: null as FrameRequestCallback | null,
    microtaskCallback: null as (() => void) | null,
    cancelAnimationFrame: vi.fn()
  }
})

vi.mock('@/renderer/core/layout/store/layoutStore', () => ({
  layoutStore: {
    onChange: vi.fn(
      (
        callback: (change: { nodeIds: string[]; source: LayoutSource }) => void
      ) => {
        testState.listener = callback
        return testState.unsubscribe
      }
    ),
    getNodeLayoutRef: vi.fn((nodeId: string) => ({
      value: testState.layoutByNodeId.get(nodeId) ?? null
    }))
  }
}))

import { useLayoutSync } from '@/renderer/core/layout/sync/useLayoutSync'

const LayoutSyncHarness = defineComponent({
  setup() {
    return useLayoutSync()
  },
  template: '<div />'
})

describe('useLayoutSync', () => {
  beforeEach(() => {
    testState.listener = null
    testState.layoutByNodeId.clear()
    testState.unsubscribe.mockReset()
    testState.rafCallback = null
    testState.microtaskCallback = null
    testState.cancelAnimationFrame.mockReset()

    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      testState.rafCallback = cb
      return 1
    })
    vi.stubGlobal('cancelAnimationFrame', testState.cancelAnimationFrame)
    vi.stubGlobal('queueMicrotask', (cb: () => void) => {
      testState.microtaskCallback = cb
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

    const wrapper = mount(LayoutSyncHarness)

    wrapper.vm.startSync(canvas as never)

    testState.listener?.({ nodeIds: ['1'], source: LayoutSource.External })
    testState.listener?.({ nodeIds: ['1'], source: LayoutSource.External })

    expect(canvas.setDirty).not.toHaveBeenCalled()
    expect(testState.microtaskCallback).toBeNull()

    testState.rafCallback?.(0)

    expect(canvas.setDirty).toHaveBeenCalledTimes(1)
    expect(canvas.graph.getNodeById).toHaveBeenCalledTimes(1)
    expect(liteNode.pos).toEqual([10, 15])
    expect(liteNode.size).toEqual([120, 70])

    wrapper.unmount()
  })

  it('flushes interactive updates in a microtask without waiting for raf', () => {
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
      position: { x: 20, y: 30 },
      size: { width: 120, height: 70 }
    })

    const wrapper = mount(LayoutSyncHarness)

    wrapper.vm.startSync(canvas as never)
    testState.listener?.({ nodeIds: ['1'], source: LayoutSource.Vue })

    expect(testState.rafCallback).toBeNull()
    expect(canvas.setDirty).not.toHaveBeenCalled()

    testState.microtaskCallback?.()

    expect(canvas.setDirty).toHaveBeenCalledTimes(1)
    expect(liteNode.pos).toEqual([20, 30])

    wrapper.unmount()
  })

  it('promotes queued raf work to microtask when interactive changes arrive', () => {
    const canvas = {
      graph: {
        getNodeById: vi.fn(() => ({
          pos: [0, 0],
          size: [100, 50],
          onResize: vi.fn()
        }))
      },
      setDirty: vi.fn()
    }

    testState.layoutByNodeId.set('1', {
      position: { x: 5, y: 6 },
      size: { width: 100, height: 50 }
    })

    const wrapper = mount(LayoutSyncHarness)

    wrapper.vm.startSync(canvas as never)
    testState.listener?.({ nodeIds: ['1'], source: LayoutSource.External })
    expect(testState.rafCallback).toBeTruthy()

    testState.listener?.({ nodeIds: ['1'], source: LayoutSource.DOM })

    expect(testState.cancelAnimationFrame).toHaveBeenCalledWith(1)
    expect(testState.microtaskCallback).toBeTruthy()

    wrapper.unmount()
  })
})
