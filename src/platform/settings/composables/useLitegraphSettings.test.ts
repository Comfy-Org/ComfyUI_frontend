import { fromPartial } from '@total-typescript/shoehorn'
import { effectScope, nextTick } from 'vue'
import type { EffectScope } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useAgentNodeSelectionStore } from '@/stores/agentNodeSelectionStore'

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

  // The overlay is drawn onto the canvas rather than composed in the DOM, so it
  // cannot be hidden with CSS alongside the rest of the chrome.
  it('suppresses the canvas info overlay during node selection mode and restores it on exit', async () => {
    const canvasStore = getCanvasStore()
    const settingStore = useSettingStore()
    const nodeSelectionStore = useAgentNodeSelectionStore()
    settingStore.settingValues['Comfy.Graph.CanvasInfo'] = true
    const canvas = fromPartial<LGraphCanvas>({
      show_info: false,
      draw: vi.fn(),
      setDirty: vi.fn()
    })
    canvasStore.canvas = canvas

    scope.run(useLitegraphSettings)
    expect(canvas.show_info).toBe(true)

    nodeSelectionStore.isActive = true
    await nextTick()
    expect(canvas.show_info).toBe(false)

    nodeSelectionStore.isActive = false
    await nextTick()
    // The user's setting is untouched: exit restores the overlay from it.
    expect(canvas.show_info).toBe(true)
    expect(settingStore.settingValues['Comfy.Graph.CanvasInfo']).toBe(true)
  })

  it('leaves the overlay off during the mode when the setting is disabled', async () => {
    const canvasStore = getCanvasStore()
    const nodeSelectionStore = useAgentNodeSelectionStore()
    const canvas = fromPartial<LGraphCanvas>({
      show_info: true,
      draw: vi.fn(),
      setDirty: vi.fn()
    })
    canvasStore.canvas = canvas

    scope.run(useLitegraphSettings)
    expect(canvas.show_info).toBe(false)

    nodeSelectionStore.isActive = true
    await nextTick()
    expect(canvas.show_info).toBe(false)

    nodeSelectionStore.isActive = false
    await nextTick()
    expect(canvas.show_info).toBe(false)
  })
})
