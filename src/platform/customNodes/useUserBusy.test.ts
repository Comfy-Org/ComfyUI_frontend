import { afterEach, assert, describe, expect, it } from 'vitest'
import { effectScope, nextTick } from 'vue'

import { useUserBusy } from './useUserBusy'

describe('useUserBusy', () => {
  const scopes: ReturnType<typeof effectScope>[] = []

  afterEach(() => {
    for (const scope of scopes.splice(0)) scope.stop()
    document.body.replaceChildren()
  })

  function watchUserBusy() {
    const scope = effectScope()
    scopes.push(scope)
    const userBusy = scope.run(useUserBusy)
    assert.exists(userBusy)
    return userBusy
  }

  function focusedField(tag: 'input' | 'textarea' | 'div') {
    const field = document.createElement(tag)
    if (tag === 'div') field.contentEditable = 'true'
    document.body.append(field)
    field.focus()
    return field
  }

  it('is busy while a pointer is held, even over a canvas that stops propagation', () => {
    const userBusy = watchUserBusy()
    const canvas = document.createElement('canvas')
    document.body.append(canvas)
    canvas.addEventListener('pointerdown', (event) => event.stopPropagation(), {
      capture: true
    })

    canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    expect(userBusy.value).toBe(true)

    window.dispatchEvent(new PointerEvent('pointerup'))
    expect(userBusy.value).toBe(false)
  })

  it('stops being busy when a held pointer is cancelled', () => {
    const userBusy = watchUserBusy()

    window.dispatchEvent(new PointerEvent('pointerdown'))
    window.dispatchEvent(new PointerEvent('pointercancel'))

    expect(userBusy.value).toBe(false)
  })

  it.for(['input', 'textarea', 'div'] as const)(
    'is busy while a %s holds focus',
    (tag) => {
      const userBusy = watchUserBusy()

      const field = focusedField(tag)
      expect(userBusy.value).toBe(true)

      field.blur()
      expect(userBusy.value).toBe(false)
    }
  )

  it('stops being busy when a focused field is removed without blurring', async () => {
    const userBusy = watchUserBusy()
    const field = focusedField('input')
    expect(userBusy.value).toBe(true)

    field.remove()
    await nextTick()

    expect(userBusy.value).toBe(false)
  })

  it('stops reporting after its scope is disposed', () => {
    const userBusy = watchUserBusy()

    scopes[0].stop()
    window.dispatchEvent(new PointerEvent('pointerdown'))

    expect(userBusy.value).toBe(false)
  })
})
