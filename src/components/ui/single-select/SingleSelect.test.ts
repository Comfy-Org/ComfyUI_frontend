import { render, screen } from '@testing-library/vue'
import type { ComponentProps } from 'vue-component-type-helpers'
import { afterEach, describe, expect, it } from 'vitest'
import { nextTick, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import { zIndexManager } from '@/utils/zIndexManager'

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

function renderInParent(
  modelValue?: string,
  singleSelectProps: Partial<ComponentProps<typeof SingleSelect>> = {}
) {
  const parentEscapeCount = { value: 0 }

  const Parent = {
    template:
      '<div @keydown.escape="onEsc"><SingleSelect v-model="sel" :options="options" label="Pick" v-bind="extraProps" /></div>',
    components: { SingleSelect },
    setup() {
      return {
        sel: ref(modelValue),
        options,
        extraProps: singleSelectProps,
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

let openModal: HTMLElement | undefined

afterEach(() => {
  if (openModal) {
    zIndexManager.clear(openModal)
    openModal = undefined
  }
})

describe('SingleSelect', () => {
  it('opens above a dialog registered with the modal z-index counter', async () => {
    openModal = document.createElement('div')
    zIndexManager.set('modal', openModal, 3702)
    const dialogZIndex = Number(openModal.style.zIndex)
    const { unmount } = renderInParent()

    await openSelect(screen.getByRole('combobox'))

    const content = findContentElement()
    expect(content).not.toBeNull()
    expect(Number(content!.style.zIndex)).toBeGreaterThan(dialogZIndex)

    unmount()
  })

  it('opens above a dialog even when the caller passes its own contentStyle z-index', async () => {
    openModal = document.createElement('div')
    zIndexManager.set('modal', openModal, 3702)
    const dialogZIndex = Number(openModal.style.zIndex)
    const { unmount } = renderInParent(undefined, {
      contentStyle: { zIndex: 3000 }
    })

    await openSelect(screen.getByRole('combobox'))

    const content = findContentElement()
    expect(content).not.toBeNull()
    expect(Number(content!.style.zIndex)).toBeGreaterThan(dialogZIndex)

    unmount()
  })

  it('lets a consumer class override the trigger variant it conflicts with', () => {
    const { unmount } = render(SingleSelect, {
      props: { modelValue: undefined, options, label: 'Pick' },
      attrs: { class: 'bg-transparent' },
      global: { plugins: [i18n] }
    })

    const trigger = screen.getByRole('combobox')
    expect(trigger).toHaveClass('bg-transparent')
    expect(trigger).not.toHaveClass('bg-secondary-background')

    unmount()
  })

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
