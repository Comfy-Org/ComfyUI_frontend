import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { effectScope, ref } from 'vue'
import type { EffectScope, Ref } from 'vue'

import { useDismissableOverlay } from '@/composables/useDismissableOverlay'

describe('useDismissableOverlay', () => {
  let scope: EffectScope | undefined
  let isOpen: Ref<boolean>
  let overlayEl: HTMLElement
  let triggerEl: HTMLElement
  let outsideEl: HTMLElement
  let dismissCount: number

  const mountComposable = ({
    dismissOnScroll = false,
    getTriggerEl
  }: {
    dismissOnScroll?: boolean
    getTriggerEl?: () => HTMLElement | null
  } = {}) => {
    scope = effectScope()
    scope.run(() =>
      useDismissableOverlay({
        isOpen,
        getOverlayEl: () => overlayEl,
        getTriggerEl,
        onDismiss: () => {
          dismissCount += 1
        },
        dismissOnScroll
      })
    )
  }

  beforeEach(() => {
    isOpen = ref(true)
    overlayEl = document.createElement('div')
    triggerEl = document.createElement('button')
    outsideEl = document.createElement('div')
    dismissCount = 0
    document.body.append(overlayEl, triggerEl, outsideEl)
  })

  afterEach(() => {
    scope?.stop()
    scope = undefined
    document.body.innerHTML = ''
  })

  it('dismisses on outside pointerdown', () => {
    mountComposable()

    outsideEl.dispatchEvent(new Event('pointerdown', { bubbles: true }))

    expect(dismissCount).toBe(1)
  })

  it('ignores pointerdown inside the overlay', () => {
    mountComposable()

    overlayEl.dispatchEvent(new Event('pointerdown', { bubbles: true }))

    expect(dismissCount).toBe(0)
  })

  it('ignores pointerdown inside the trigger', () => {
    mountComposable({
      getTriggerEl: () => triggerEl
    })

    triggerEl.dispatchEvent(new Event('pointerdown', { bubbles: true }))

    expect(dismissCount).toBe(0)
  })

  it('dismisses on scroll when enabled', () => {
    mountComposable({
      dismissOnScroll: true
    })

    window.dispatchEvent(new Event('scroll'))

    expect(dismissCount).toBe(1)
  })

  it('ignores scroll inside the overlay', () => {
    mountComposable({
      dismissOnScroll: true
    })

    overlayEl.dispatchEvent(new Event('scroll'))

    expect(dismissCount).toBe(0)
  })

  it('does not dismiss when closed', () => {
    isOpen.value = false
    mountComposable({
      dismissOnScroll: true
    })

    outsideEl.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    window.dispatchEvent(new Event('scroll'))

    expect(dismissCount).toBe(0)
  })
})
