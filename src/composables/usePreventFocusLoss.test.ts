import { afterEach, describe, expect, it } from 'vitest'
import { effectScope, ref } from 'vue'

import { usePreventFocusLoss } from './usePreventFocusLoss'

function setup(container: HTMLElement) {
  const scope = effectScope()
  const containerRef = ref<HTMLElement | null>(container)
  scope.run(() => usePreventFocusLoss(containerRef))
  document.body.appendChild(container)
  return () => {
    scope.stop()
    container.remove()
  }
}

function fireMousedown(el: Element): MouseEvent {
  const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true })
  el.dispatchEvent(event)
  return event
}

describe('usePreventFocusLoss', () => {
  let teardown: () => void

  afterEach(() => teardown?.())

  it('prevents default on mousedown for a plain div (stops focus theft)', () => {
    const container = document.createElement('div')
    const inner = document.createElement('div')
    container.appendChild(inner)
    teardown = setup(container)

    const event = fireMousedown(inner)

    expect(event.defaultPrevented).toBe(true)
  })

  it('prevents default when clicking a button (click still fires, focus stays on canvas)', () => {
    const container = document.createElement('div')
    const btn = document.createElement('button')
    container.appendChild(btn)
    teardown = setup(container)

    const event = fireMousedown(btn)

    expect(event.defaultPrevented).toBe(true)
  })

  it('does not prevent default when clicking an input', () => {
    const container = document.createElement('div')
    const input = document.createElement('input')
    container.appendChild(input)
    teardown = setup(container)

    const event = fireMousedown(input)

    expect(event.defaultPrevented).toBe(false)
  })

  it('does not prevent default when clicking a textarea', () => {
    const container = document.createElement('div')
    const textarea = document.createElement('textarea')
    container.appendChild(textarea)
    teardown = setup(container)

    const event = fireMousedown(textarea)

    expect(event.defaultPrevented).toBe(false)
  })

  it('does not prevent default when clicking a contenteditable element', () => {
    const container = document.createElement('div')
    const editable = document.createElement('div')
    editable.contentEditable = 'true'
    container.appendChild(editable)
    teardown = setup(container)

    const event = fireMousedown(editable)

    expect(event.defaultPrevented).toBe(false)
  })
})
