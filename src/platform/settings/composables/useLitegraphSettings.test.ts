import { fromPartial } from '@total-typescript/shoehorn'
import { effectScope, nextTick } from 'vue'
import type { EffectScope } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore' // eslint-disable-line import-x/no-restricted-paths
import { useAgentNodeSelectionStore } from '@/stores/agentNodeSelectionStore'

import { useLitegraphSettings } from './useLitegraphSettings'

function createCanvas(draw: () => void): LGraphCanvas {
  return fromPartial<LGraphCanvas>({ draw, setDirty: vi.fn() })
}

describe('useLitegraphSettings', () => {
  let scope: EffectScope

  beforeEach(() => {
    scope = effectScope()
    useSettingStore().settingValues['Comfy.Graph.CanvasInfo'] = false
  })

  afterEach(() => scope.stop())

  it('does not make slot reads during drawing reactive dependencies', async () => {
    const node = new LGraphNode('test')
    const slot = node.addInput('input', '*')
    const draw = vi.fn(() => slot.pos)
    useCanvasStore().canvas = createCanvas(draw)

    scope.run(useLitegraphSettings)

    expect(draw).toHaveBeenCalledOnce()

    slot.pos = [10, 20]
    await nextTick()

    expect(draw).toHaveBeenCalledOnce()
  })

  it('redraws when CanvasInfo or the canvas changes', async () => {
    const firstDraw = vi.fn()
    const secondDraw = vi.fn()
    const canvasStore = useCanvasStore()
    const settingStore = useSettingStore()
    canvasStore.canvas = createCanvas(firstDraw)

    scope.run(useLitegraphSettings)
    settingStore.settingValues['Comfy.Graph.CanvasInfo'] = true
    await nextTick()

    expect(canvasStore.canvas.show_info).toBe(true)
    expect(firstDraw).toHaveBeenCalledTimes(2)

    canvasStore.canvas = createCanvas(secondDraw)
    await nextTick()

    expect(canvasStore.canvas.show_info).toBe(true)
    expect(secondDraw).toHaveBeenCalledOnce()
  })

  it.for([
    { canvasInfo: true, picking: false, showInfo: true },
    { canvasInfo: true, picking: true, showInfo: false },
    { canvasInfo: false, picking: false, showInfo: false },
    { canvasInfo: false, picking: true, showInfo: false }
  ])(
    'CanvasInfo=$canvasInfo while picking=$picking shows the info overlay: $showInfo',
    async ({ canvasInfo, picking, showInfo }) => {
      const canvasStore = useCanvasStore()
      canvasStore.canvas = createCanvas(vi.fn())
      useSettingStore().settingValues['Comfy.Graph.CanvasInfo'] = canvasInfo
      useAgentNodeSelectionStore().isActive = picking

      scope.run(useLitegraphSettings)
      await nextTick()

      expect(canvasStore.canvas.show_info).toBe(showInfo)
    }
  )

  it('honours a CanvasInfo toggle made while picking once the mode ends', async () => {
    const draw = vi.fn()
    const canvasStore = useCanvasStore()
    const settingStore = useSettingStore()
    const agentNodeSelectionStore = useAgentNodeSelectionStore()
    canvasStore.canvas = createCanvas(draw)
    settingStore.settingValues['Comfy.Graph.CanvasInfo'] = true
    scope.run(useLitegraphSettings)

    agentNodeSelectionStore.isActive = true
    await nextTick()
    settingStore.settingValues['Comfy.Graph.CanvasInfo'] = false
    await nextTick()
    agentNodeSelectionStore.isActive = false
    await nextTick()

    expect(canvasStore.canvas.show_info).toBe(false)
    expect(draw).toHaveBeenCalledTimes(4)
  })
})
