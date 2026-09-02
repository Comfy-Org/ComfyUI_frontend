import { createPinia, setActivePinia } from 'pinia'
import { effectScope, nextTick } from 'vue'
import { expect, it, vi } from 'vitest'

import { LGraph, LGraphCanvas, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useSettingStore } from '@/platform/settings/settingStore'
// eslint-disable-next-line import-x/no-restricted-paths -- Settings adapter verifies legacy canvas synchronization.
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'

import { useLitegraphSettings } from './useLitegraphSettings'

const createCanvas = (draw: () => void) => {
  const element = document.createElement('canvas')
  element.getContext = vi.fn().mockReturnValue({})
  const canvas = new LGraphCanvas(element, new LGraph(), {
    skip_events: true,
    skip_render: true
  })
  vi.spyOn(canvas, 'draw').mockImplementation(draw)
  return canvas
}

it('contains CanvasInfo draws to its explicit sources', async () => {
  setActivePinia(createPinia())
  const node = new LGraphNode('test')
  const slot = node.addInput('input', 'STRING')
  const firstCanvas = createCanvas(() => {
    node._setConcreteSlots()
    void slot.pos
  })
  const canvasStore = useCanvasStore()
  const settingStore = useSettingStore()
  settingStore.settingValues['Comfy.Graph.CanvasInfo'] = true
  canvasStore.canvas = firstCanvas

  const scope = effectScope()
  scope.run(useLitegraphSettings)
  await nextTick()
  vi.mocked(firstCanvas.draw).mockClear()

  slot.pos = [10, 20]
  await nextTick()
  expect(firstCanvas.draw).not.toHaveBeenCalled()

  settingStore.settingValues['Comfy.Graph.CanvasInfo'] = false
  await nextTick()
  expect(firstCanvas.show_info).toBe(false)
  expect(firstCanvas.draw).toHaveBeenCalledTimes(1)

  const replacement = createCanvas(() => {
    node._setConcreteSlots()
    void slot.pos
  })
  canvasStore.canvas = replacement
  await nextTick()
  expect(replacement.show_info).toBe(false)
  expect(replacement.draw).toHaveBeenCalledTimes(1)
  scope.stop()
})
