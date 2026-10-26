import { fromPartial } from '@total-typescript/shoehorn'
import { effectScope, nextTick } from 'vue'
import type { EffectScope } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore' // oxlint-disable-line comfy/no-restricted-paths
import type { LLink } from '@/lib/litegraph/src/LLink'
import { LinkRenderType } from '@/lib/litegraph/src/types/globalEnums'
import { useLinkSelectionStore } from '@/stores/linkSelectionStore'

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
      canvasStore.isPickingNodes = picking

      scope.run(useLitegraphSettings)
      await nextTick()

      expect(canvasStore.canvas.show_info).toBe(showInfo)
    }
  )

  it('honours a CanvasInfo toggle made while picking once the mode ends', async () => {
    const draw = vi.fn()
    const canvasStore = useCanvasStore()
    const settingStore = useSettingStore()
    canvasStore.canvas = createCanvas(draw)
    settingStore.settingValues['Comfy.Graph.CanvasInfo'] = true
    scope.run(useLitegraphSettings)

    canvasStore.isPickingNodes = true
    await nextTick()
    settingStore.settingValues['Comfy.Graph.CanvasInfo'] = false
    await nextTick()
    canvasStore.isPickingNodes = false
    await nextTick()

    expect(canvasStore.canvas.show_info).toBe(false)
    expect(draw).toHaveBeenCalledTimes(4)
  })

  it.for([
    { mode: LinkRenderType.HIDDEN_LINK, cleared: true },
    { mode: LinkRenderType.SPLINE_LINK, cleared: false }
  ])(
    'clears the link selection only when links are hidden (mode $mode)',
    async ({ mode, cleared }) => {
      useCanvasStore().canvas = createCanvas(vi.fn())
      const linkSelection = useLinkSelectionStore()
      linkSelection.select({
        links: [fromPartial<LLink>({ id: 1 })],
        marquee: { x: 0, y: 0, width: 10, height: 10 },
        anchorX: 0
      })

      scope.run(useLitegraphSettings)
      useSettingStore().settingValues['Comfy.LinkRenderMode'] = mode
      await nextTick()

      expect(linkSelection.selection === null).toBe(cleared)
    }
  )
})
