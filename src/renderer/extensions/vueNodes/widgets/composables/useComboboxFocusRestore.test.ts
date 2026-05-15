import { render, screen } from '@testing-library/vue'
import type { FocusOutsideEvent } from 'reka-ui'
import { describe, expect, it } from 'vitest'
import { defineComponent, ref } from 'vue'

import { useComboboxFocusRestore } from './useComboboxFocusRestore'

function createFocusOutsideEvent() {
  return new CustomEvent('focusoutside', {
    cancelable: true,
    detail: { originalEvent: new FocusEvent('focus') }
  }) as FocusOutsideEvent
}

function renderHost() {
  let api!: ReturnType<typeof useComboboxFocusRestore>

  const Host = defineComponent({
    setup() {
      const inputContainerRef = ref<HTMLElement>()
      api = useComboboxFocusRestore(inputContainerRef)

      return {
        inputContainerRef
      }
    },
    template: `
      <div>
        <div ref="inputContainerRef">
          <input data-testid="search-input" />
        </div>
      </div>
    `
  })

  const result = render(Host)

  return {
    ...result,
    api
  }
}

describe('useComboboxFocusRestore', () => {
  it('keeps focus inside the combobox after viewport pointerdown', () => {
    const { api } = renderHost()

    api.handleViewportPointerDown()
    const event = createFocusOutsideEvent()
    api.handleFocusOutside(event)

    expect(event.defaultPrevented).toBe(true)
    expect(screen.getByTestId('search-input')).toHaveFocus()
  })

  it('allows ordinary focus outside events', () => {
    const { api } = renderHost()

    const event = createFocusOutsideEvent()
    api.handleFocusOutside(event)

    expect(event.defaultPrevented).toBe(false)
  })

  it('clears the restore state after pointerup', () => {
    const { api } = renderHost()

    api.handleViewportPointerDown()
    window.dispatchEvent(new Event('pointerup'))

    const event = createFocusOutsideEvent()
    api.handleFocusOutside(event)

    expect(event.defaultPrevented).toBe(false)
  })
})
