import { nextTick } from 'vue'
import { describe, expect, it } from 'vitest'

import { useDomValueBridge } from './useDomValueBridge'

function createInput(initialValue = ''): HTMLInputElement {
  const el = document.createElement('input')
  el.value = initialValue
  return el
}

function createTextarea(initialValue = ''): HTMLTextAreaElement {
  const el = document.createElement('textarea')
  el.value = initialValue
  return el
}

describe('useDomValueBridge', () => {
  it('initializes the ref with the current element value', () => {
    const el = createInput('hello')
    const bridged = useDomValueBridge(el)
    expect(bridged.value).toBe('hello')
  })

  it('updates the ref when element.value is set programmatically', () => {
    const el = createInput('')
    const bridged = useDomValueBridge(el)

    el.value = 'updated'
    expect(bridged.value).toBe('updated')
  })

  it('updates the ref on user input events', () => {
    const el = createInput('')
    const bridged = useDomValueBridge(el)

    // Simulate user typing by using the original descriptor to set value,
    // then dispatching an input event
    const proto = Object.getPrototypeOf(el)
    const desc = Object.getOwnPropertyDescriptor(proto, 'value')
    desc?.set?.call(el, 'typed')
    el.dispatchEvent(new Event('input'))

    expect(bridged.value).toBe('typed')
  })

  it('updates the DOM element when the ref is written to', async () => {
    const el = createInput('initial')
    const bridged = useDomValueBridge(el)

    bridged.value = 'from-ref'
    await nextTick()

    expect(el.value).toBe('from-ref')
  })

  it('works with textarea elements', () => {
    const el = createTextarea('initial')
    const bridged = useDomValueBridge(el)

    expect(bridged.value).toBe('initial')
    el.value = 'new text'
    expect(bridged.value).toBe('new text')
  })

  it('reads element value through the intercepted getter', async () => {
    const el = createInput('start')
    const bridged = useDomValueBridge(el)

    // The getter on element.value should still work
    expect(el.value).toBe('start')

    bridged.value = 'changed'
    await nextTick()
    // The element getter should reflect the latest set
    expect(el.value).toBe('changed')
  })
})
