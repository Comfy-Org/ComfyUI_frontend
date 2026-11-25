import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import FormDropdownResizeHandle from './FormDropdownResizeHandle.vue'
import type { PanelSize, ResizeHandle } from './resizePanel'

function renderHandle(
  handle: ResizeHandle,
  resized?: { size: PanelSize; alignOffset: number }
) {
  const sizes: (PanelSize | undefined)[] = []
  const offsets: number[] = []
  render(FormDropdownResizeHandle, {
    props: {
      handle,
      ...resized,
      'onUpdate:size': (size: PanelSize | undefined) => sizes.push(size),
      'onUpdate:alignOffset': (offset: number) => offsets.push(offset)
    },
    global: {
      plugins: [createI18n({ legacy: false, locale: 'en', missing: () => '' })]
    }
  })
  return { grip: screen.getByRole('button'), sizes, offsets }
}

describe('FormDropdownResizeHandle', () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
      DOMRect.fromRect({ width: 400, height: 600 })
    )
  })

  it('keeps a drag bound to the pointer that started it', async () => {
    const { grip, sizes } = renderHandle('left-corner')
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
    { handle: 'left-corner', key: '{ArrowLeft}', width: 416, offsets: [] },
    { handle: 'right-corner', key: '{ArrowRight}', width: 416, offsets: [-16] }
  ] as const)(
    '$handle grows the panel and shifts it by $offsets',
    async ({ handle, key, width, offsets }) => {
      const rendered = renderHandle(handle)
      rendered.grip.focus()
      await userEvent.keyboard(key)

      expect(rendered.sizes.map((size) => size?.width)).toEqual([width])
      expect(rendered.offsets).toEqual(offsets)
    }
  )

  it('resets the size and shift on double-click', async () => {
    const { grip, sizes, offsets } = renderHandle('right-corner', {
      size: { width: 500, height: 700 },
      alignOffset: -100
    })

    await userEvent.dblClick(grip)

    expect(sizes).toEqual([undefined])
    expect(offsets).toEqual([0])
  })
})
