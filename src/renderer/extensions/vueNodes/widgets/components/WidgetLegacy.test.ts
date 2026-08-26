import { fromAny, fromPartial } from '@total-typescript/shoehorn'
import { createTestingPinia } from '@pinia/testing'
import { render } from '@testing-library/vue'
import { setActivePinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, KeepAlive, nextTick, ref } from 'vue'

import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphCanvas } from '@/lib/litegraph/src/LGraphCanvas'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { toNodeId } from '@/types/nodeId'

import WidgetLegacy from './WidgetLegacy.vue'

vi.mock('@vueuse/core', async (importOriginal) => ({
  ...(await importOriginal()),
  useResizeObserver: vi.fn()
}))

describe('WidgetLegacy', () => {
  it('redraws at the current quality after KeepAlive reactivation', async () => {
    const pinia = createTestingPinia({ stubActions: false })
    setActivePinia(pinia)

    const nodeId = toNodeId(1)
    const draw = vi.fn<NonNullable<IBaseWidget['draw']>>()
    const widget = fromPartial<IBaseWidget>({
      draw,
      name: 'legacy_widget'
    })
    const node = fromAny<LGraphNode, unknown>({ id: nodeId, widgets: [widget] })
    const graph = fromPartial<LGraph>({
      events: new EventTarget(),
      getNodeById: () => node
    })
    let lowQuality = false
    const canvas = fromPartial<LGraphCanvas>({
      canvas: document.createElement('canvas'),
      graph,
      get low_quality() {
        return lowQuality
      }
    })
    useCanvasStore().canvas = canvas
    await nextTick()

    const context = fromPartial<CanvasRenderingContext2D>({ scale: vi.fn() })
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      fromAny(context)
    )
    vi.spyOn(
      HTMLCanvasElement.prototype,
      'getBoundingClientRect'
    ).mockReturnValue(fromPartial<DOMRect>({ width: 100 }))

    const active = ref(true)
    const Parent = defineComponent({
      components: { KeepAlive, WidgetLegacy },
      setup: () => ({ active, nodeId }),
      template: `
        <KeepAlive>
          <WidgetLegacy
            v-if="active"
            :node-id="nodeId"
            :widget="{ name: 'legacy_widget' }"
          />
        </KeepAlive>
      `
    })

    render(Parent, { global: { plugins: [pinia] } })
    await nextTick()
    expect(draw).toHaveBeenCalledOnce()

    active.value = false
    lowQuality = true
    await nextTick()
    lowQuality = false
    active.value = true
    await nextTick()

    expect(draw).toHaveBeenCalledTimes(2)
    expect(draw).toHaveBeenLastCalledWith(context, node, 100, 1, 20, false)
  })
})
