// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { defineComponent, nextTick, ref } from 'vue'
import { describe, expect, it } from 'vitest'

import { useSlidingUnderline } from './useSlidingUnderline'

function harness(selector?: string) {
  const watched = ref('first')
  const state = { underline: ref({ left: 0, width: 0 }) }
  const activeAttribute = selector
    ? 'data-state="active"'
    : 'aria-pressed="true"'
  const view = render(
    defineComponent({
      setup() {
        const nav = ref<HTMLElement | null>(null)
        state.underline = useSlidingUnderline(
          nav,
          () => watched.value,
          selector
        )
        return { nav }
      },
      template: `<nav ref="nav"><button ${activeAttribute}>Tab</button></nav>`
    })
  )
  const button = screen.getByRole('button')
  Object.defineProperties(button, {
    offsetLeft: { configurable: true, value: 24 },
    offsetWidth: { configurable: true, value: 80 }
  })
  return { ...view, button, underline: state.underline, watched }
}

describe('useSlidingUnderline', () => {
  it('measures the active element using the default or supplied selector', async () => {
    for (const selector of [undefined, '[data-state="active"]']) {
      const { underline, watched, unmount } = harness(selector)
      watched.value = 'second'
      await nextTick()
      await nextTick()
      expect(underline.value).toEqual({ left: 24, width: 80 })
      unmount()
    }
  })

  it('clears the measurement when the watched change has no active element', async () => {
    const { button, underline, watched } = harness()
    watched.value = 'measured'
    await nextTick()
    await nextTick()
    button.setAttribute('aria-pressed', 'false')
    watched.value = 'missing'
    await nextTick()
    await nextTick()
    expect(underline.value).toEqual({ left: 0, width: 0 })
  })
})
