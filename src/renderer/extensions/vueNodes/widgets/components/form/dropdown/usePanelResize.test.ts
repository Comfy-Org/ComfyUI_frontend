import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref, watch } from 'vue'
import { createI18n } from 'vue-i18n'

import ResizeHandle from '@/renderer/extensions/vueNodes/components/ResizeHandle.vue'
import type { ResizeDirection } from '@/renderer/extensions/vueNodes/interactions/resize/resizeDirection'

import type { PanelSide, PanelSize } from './resizePanel'
import { usePanelResize } from './usePanelResize'

function renderPanel(
  direction: ResizeDirection,
  resized?: { size: PanelSize; alignOffset: number },
  anchor?: HTMLElement
) {
  const sizes: (PanelSize | undefined)[] = []
  const offsets: number[] = []
  const Panel = defineComponent(() => {
    const size = ref(resized?.size)
    const alignOffset = ref(resized?.alignOffset ?? 0)
    const panel = usePanelResize({
      size,
      alignOffset,
      side: ref<PanelSide>(),
      anchor: () => anchor
    })
    watch(size, (next) => sizes.push(next), { flush: 'sync' })
    watch(alignOffset, (next) => offsets.push(next), { flush: 'sync' })
    return () =>
      h('div', [
        h(ResizeHandle, {
          direction,
          onResize: panel.startResize,
          onNudge: panel.nudge,
          onFit: panel.reset
        })
      ])
  })
  render(Panel, {
    global: {
      plugins: [createI18n({ legacy: false, locale: 'en', missing: () => '' })]
    }
  })
  return { grip: screen.getByRole('button'), sizes, offsets }
}

describe('usePanelResize', () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
      DOMRect.fromRect({ x: 400, y: 100, width: 400, height: 600 })
    )
  })

  it('keeps a drag bound to the pointer that started it', async () => {
    const { grip, sizes } = renderPanel('SW')
    const user = userEvent.setup()

    await user.pointer([
      { keys: '[TouchA>]', target: grip, coords: { clientX: 0, clientY: 0 } },
      { keys: '[TouchB>]', target: grip, coords: { clientX: 300, clientY: 0 } },
      {
        pointerName: 'TouchB',
        target: grip,
        coords: { clientX: -900, clientY: 0 }
      },
      {
        pointerName: 'TouchA',
        target: grip,
        coords: { clientX: -100, clientY: 0 }
      },
      { keys: '[/TouchB]', target: grip },
      {
        pointerName: 'TouchA',
        target: grip,
        coords: { clientX: -200, clientY: 0 }
      }
    ])

    expect(sizes.map((size) => size?.width)).toEqual([500, 600])
  })

  it.for([
    { direction: 'SW', key: '{ArrowLeft}', width: 416, offsets: [] },
    { direction: 'SE', key: '{ArrowRight}', width: 416, offsets: [-16] }
  ] as const)(
    '$direction grows the panel and shifts it by $offsets',
    async ({ direction, key, width, offsets }) => {
      const rendered = renderPanel(direction)
      rendered.grip.focus()
      await userEvent.keyboard(key)

      expect(rendered.sizes.map((size) => size?.width)).toEqual([width])
      expect(rendered.offsets).toEqual(offsets)
    }
  )

  it.for([
    { direction: 'SW', key: '{ArrowLeft}', offsets: [20] },
    { direction: 'SE', key: '{ArrowRight}', offsets: [4] }
  ] as const)(
    '$direction keeps the panel where the viewport pushed it, off its anchor by 20px',
    async ({ direction, key, offsets }) => {
      const anchor = document.createElement('button')
      Object.defineProperty(anchor, 'getBoundingClientRect', {
        value: () => DOMRect.fromRect({ x: 700, y: 60, width: 120, height: 30 })
      })
      const rendered = renderPanel(direction, undefined, anchor)
      rendered.grip.focus()
      await userEvent.keyboard(key)

      expect(rendered.offsets).toEqual(offsets)
    }
  )

  it('resets the size and shift on double-click', async () => {
    const { grip, sizes, offsets } = renderPanel('SE', {
      size: { width: 500, height: 700 },
      alignOffset: -100
    })

    await userEvent.dblClick(grip)

    expect(sizes).toEqual([undefined])
    expect(offsets).toEqual([0])
  })
})
