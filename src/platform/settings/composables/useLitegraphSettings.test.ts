import { fromPartial } from '@total-typescript/shoehorn'
import { effectScope, nextTick } from 'vue'
import type { EffectScope } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useSettingStore } from '@/platform/settings/settingStore'

const testState = vi.hoisted(
  (): { canvasStore: { canvas: LGraphCanvas | null } | null } => ({
    canvasStore: null
  })
)

vi.mock('@/renderer/core/canvas/canvasStore', async () => {
  const { reactive } = await import('vue')
  testState.canvasStore = reactive({ canvas: null })
  return { useCanvasStore: () => testState.canvasStore }
})

import { useLitegraphSettings } from './useLitegraphSettings'

function createCanvas(draw: () => void): LGraphCanvas {
  return fromPartial<LGraphCanvas>({ draw, setDirty: vi.fn() })
}

function getCanvasStore(): { canvas: LGraphCanvas | null } {
  if (!testState.canvasStore)
    throw new Error('Canvas store was not initialized')
  return testState.canvasStore
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
    getCanvasStore().canvas = createCanvas(draw)

    scope.run(useLitegraphSettings)

    expect(draw).toHaveBeenCalledOnce()

    slot.pos = [10, 20]
    await nextTick()

    expect(draw).toHaveBeenCalledOnce()
  })

  it('redraws when CanvasInfo or the canvas changes', async () => {
    const firstDraw = vi.fn()
    const secondDraw = vi.fn()
    const canvasStore = getCanvasStore()
    const settingStore = useSettingStore()
    canvasStore.canvas = createCanvas(firstDraw)

    scope.run(useLitegraphSettings)
    settingStore.settingValues['Comfy.Graph.CanvasInfo'] = true
    await nextTick()

    expect(canvasStore.canvas?.show_info).toBe(true)
    expect(firstDraw).toHaveBeenCalledTimes(2)

    canvasStore.canvas = createCanvas(secondDraw)
    await nextTick()

    expect(canvasStore.canvas.show_info).toBe(true)
    expect(secondDraw).toHaveBeenCalledOnce()
  })
})
