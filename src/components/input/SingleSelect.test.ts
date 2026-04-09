import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { nextTick, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import SingleSelect from './SingleSelect.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: {
        singleSelectDropdown: 'Single-select dropdown'
      }
    }
  }
})

const options = [
  { name: 'Option A', value: 'a' },
  { name: 'Option B', value: 'b' },
  { name: 'Option C', value: 'c' }
]

function dispatchEscape(element: Element) {
  element.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'Escape',
      code: 'Escape',
      bubbles: true
    })
  )
}

function findContentElement(): HTMLElement | null {
  return document.querySelector('[data-dismissable-layer]')
}

function renderInParent(modelValue?: string) {
  const parentEscapeCount = { value: 0 }

  const Parent = {
    template:
      '<div @keydown.escape="onEsc"><SingleSelect v-model="sel" :options="options" label="Pick" /></div>',
    components: { SingleSelect },
    setup() {
      return {
        sel: ref(modelValue),
        options,
        onEsc: () => {
          parentEscapeCount.value++
        }
      }
    }
  }

  const { unmount } = render(Parent, {
    container: document.body.appendChild(document.createElement('div')),
    global: { plugins: [i18n] }
  })

  return { unmount, parentEscapeCount }
}

async function openSelect(triggerEl: HTMLElement) {
  if (!triggerEl.hasPointerCapture) {
    triggerEl.hasPointerCapture = () => false
    triggerEl.releasePointerCapture = () => {}
  }
  triggerEl.dispatchEvent(
    new PointerEvent('pointerdown', {
      button: 0,
      pointerType: 'mouse',
      bubbles: true
    })
  )
  await nextTick()
}

describe('SingleSelect', () => {
  describe('Escape key propagation', () => {
    it('stops Escape from propagating to parent when popover is open', async () => {
      const { unmount, parentEscapeCount } = renderInParent()

      const trigger = screen.getByRole('combobox')
      await openSelect(trigger)

      const content = findContentElement()
      expect(content).not.toBeNull()

      dispatchEscape(content!)
      await nextTick()

      expect(parentEscapeCount.value).toBe(0)

      unmount()
    })

    it('closes the popover when Escape is pressed', async () => {
      const { unmount } = renderInParent()

      const trigger = screen.getByRole('combobox')
      await openSelect(trigger)
      expect(trigger).toHaveAttribute('data-state', 'open')

      const content = findContentElement()
      dispatchEscape(content!)
      await nextTick()

      expect(trigger).toHaveAttribute('data-state', 'closed')

      unmount()
    })
  })
})
