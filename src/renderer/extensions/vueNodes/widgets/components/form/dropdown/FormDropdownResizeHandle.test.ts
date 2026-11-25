import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import FormDropdownResizeHandle from './FormDropdownResizeHandle.vue'
import type { PanelSize } from './resizePanel'

function renderHandle() {
  const sizes: (PanelSize | undefined)[] = []
  render(FormDropdownResizeHandle, {
    props: {
      'onUpdate:size': (size: PanelSize | undefined) => sizes.push(size)
    },
    global: {
      plugins: [createI18n({ legacy: false, locale: 'en', missing: () => '' })]
    }
  })
  return { handle: screen.getByRole('button'), sizes }
}

describe('FormDropdownResizeHandle', () => {
  it('keeps a drag bound to the pointer that started it', async () => {
    const { handle, sizes } = renderHandle()
    const user = userEvent.setup()

    await user.pointer([
      { keys: '[TouchA>]', target: handle, coords: { clientX: 0, clientY: 0 } },
      {
        keys: '[TouchB>]',
        target: handle,
        coords: { clientX: 300, clientY: 0 }
      },
      {
        pointerName: 'TouchB',
        target: handle,
        coords: { clientX: -900, clientY: 0 }
      },
      {
        pointerName: 'TouchA',
        target: handle,
        coords: { clientX: -500, clientY: 0 }
      },
      { keys: '[/TouchB]', target: handle },
      {
        pointerName: 'TouchA',
        target: handle,
        coords: { clientX: -600, clientY: 0 }
      }
    ])

    expect(sizes.map((size) => size?.width)).toEqual([500, 600])
  })
})
