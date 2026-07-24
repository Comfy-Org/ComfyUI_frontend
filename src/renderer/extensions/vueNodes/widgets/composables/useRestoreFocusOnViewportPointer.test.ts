import { render, screen } from '@testing-library/vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'

import { useRestoreFocusOnViewportPointer } from './useRestoreFocusOnViewportPointer'

function createFocusOutsideEvent() {
  return new CustomEvent('focusoutside', {
    cancelable: true,
    detail: { originalEvent: new FocusEvent('focus') }
  })
}

function renderHost({ renderInput = true } = {}) {
  let api!: ReturnType<typeof useRestoreFocusOnViewportPointer>

  const Host = defineComponent({
    setup() {
      const inputRef = ref<HTMLInputElement>()
      api = useRestoreFocusOnViewportPointer(() => {
        if (!inputRef.value) return false
        inputRef.value.focus({ preventScroll: true })
        return true
      })

      return {
        inputRef,
        renderInput
      }
    },
    template: `
      <div>
        <input v-if="renderInput" ref="inputRef" data-testid="search-input" />
      </div>
    `
  })

  const result = render(Host)

  return {
    ...result,
    api
  }
}

describe('useRestoreFocusOnViewportPointer', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('keeps focus inside the combobox after viewport pointerdown', () => {
    const { api } = renderHost()

    api.handleViewportPointerDown()
    const event = createFocusOutsideEvent()
    api.handleFocusOutside(event)

    expect(event.defaultPrevented).toBe(true)
    expect(screen.getByTestId('search-input')).toHaveFocus()
  })

  it('allows focus outside when there is no input to restore', () => {
    const { api } = renderHost({ renderInput: false })

    api.handleViewportPointerDown()
    const event = createFocusOutsideEvent()
    api.handleFocusOutside(event)

    expect(event.defaultPrevented).toBe(false)
  })

  it('allows ordinary focus outside events', () => {
    const { api } = renderHost()

    const event = createFocusOutsideEvent()
    api.handleFocusOutside(event)

    expect(event.defaultPrevented).toBe(false)
  })

  it('removes previous global listeners before tracking another pointerdown', () => {
    const { api } = renderHost()

    api.handleViewportPointerDown()
    const removeEventListener = vi.spyOn(window, 'removeEventListener')

    api.handleViewportPointerDown()

    expect(removeEventListener).toHaveBeenCalledWith(
      'pointerup',
      expect.any(Function)
    )
    expect(removeEventListener).toHaveBeenCalledWith(
      'pointercancel',
      expect.any(Function)
    )
  })

  it('clears the restore state after pointerup', () => {
    const { api } = renderHost()

    api.handleViewportPointerDown()
    window.dispatchEvent(new Event('pointerup'))

    const event = createFocusOutsideEvent()
    api.handleFocusOutside(event)

    expect(event.defaultPrevented).toBe(false)
  })

  it('clears the restore state after pointercancel', () => {
    const { api } = renderHost()

    api.handleViewportPointerDown()
    window.dispatchEvent(new Event('pointercancel'))

    const event = createFocusOutsideEvent()
    api.handleFocusOutside(event)

    expect(event.defaultPrevented).toBe(false)
  })
})
