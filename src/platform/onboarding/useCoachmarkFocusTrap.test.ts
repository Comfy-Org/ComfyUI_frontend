import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import type { EffectScope } from 'vue'

import { useCoachmarkFocusTrap } from './useCoachmarkFocusTrap'

function button(label: string): HTMLButtonElement {
  const el = document.createElement('button')
  el.textContent = label
  return el
}

describe('useCoachmarkFocusTrap', () => {
  let scope: EffectScope
  let target: HTMLElement
  let card: HTMLElement
  let outside: HTMLButtonElement
  let t1: HTMLButtonElement
  let t2: HTMLButtonElement
  let skip: HTMLButtonElement
  let primary: HTMLButtonElement
  let suspended: boolean
  let onEscape: ReturnType<typeof vi.fn<() => void>>

  beforeEach(() => {
    target = document.createElement('div')
    t1 = button('t1')
    t2 = button('t2')
    target.append(t1, t2)
    card = document.createElement('div')
    skip = button('skip')
    primary = button('primary')
    card.append(skip, primary)
    outside = button('outside')
    document.body.append(target, card, outside)
    suspended = false
    onEscape = vi.fn<() => void>()
    scope = effectScope()
    scope.run(() =>
      useCoachmarkFocusTrap({
        cardRef: ref(card),
        getTarget: () => target,
        isSuspended: () => suspended,
        onEscape
      })
    )
  })

  afterEach(() => {
    scope.stop()
    target.remove()
    card.remove()
    outside.remove()
  })

  function press(key: string, shiftKey = false) {
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key, shiftKey, bubbles: true })
    )
  }

  function focusOutside() {
    outside.focus()
    outside.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
  }

  it('cycles from the target focusables into the card buttons on Tab', () => {
    t2.focus()
    press('Tab')
    expect(document.activeElement).toBe(skip)
  })

  it('wraps from the last focusable back to the first on Tab', () => {
    primary.focus()
    press('Tab')
    expect(document.activeElement).toBe(t1)
  })

  it('wraps from the first focusable to the last on Shift+Tab', () => {
    t1.focus()
    press('Tab', true)
    expect(document.activeElement).toBe(primary)
  })

  it('enters at the first item on Tab when focus starts outside the trap', () => {
    outside.focus()
    press('Tab')
    expect(document.activeElement).toBe(t1)
  })

  it('enters at the last item on Shift+Tab when focus starts outside the trap', () => {
    outside.focus()
    press('Tab', true)
    expect(document.activeElement).toBe(primary)
  })

  it('invokes onEscape when Escape is pressed', () => {
    press('Escape')
    expect(onEscape).toHaveBeenCalledOnce()
  })

  it('pulls stray focus back to the primary action on focusin', async () => {
    focusOutside()
    await nextTick()
    expect(document.activeElement).toBe(primary)
  })

  it('leaves stray focus alone while suspended', async () => {
    suspended = true
    focusOutside()
    await nextTick()
    expect(document.activeElement).toBe(outside)
  })

  it('leaves Tab to the mounting UI while suspended', () => {
    suspended = true
    t1.focus()
    press('Tab')
    expect(document.activeElement).toBe(t1)
  })

  it('still invokes onEscape while suspended', () => {
    suspended = true
    press('Escape')
    expect(onEscape).toHaveBeenCalledOnce()
  })
})
