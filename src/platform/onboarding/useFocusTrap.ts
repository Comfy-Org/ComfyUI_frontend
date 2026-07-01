import { useEventListener } from '@vueuse/core'
import { nextTick } from 'vue'
import type { Ref } from 'vue'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

interface FocusTrapOptions {
  cardRef: Ref<HTMLElement | null>
  /** The spotlighted element, whose focusables join the cycle. */
  getTarget: () => HTMLElement | null
  /** Suspend the focusin pull-back (e.g. while a deferred dialog autofocuses). */
  isSuspended: () => boolean
  onEscape: () => void
}

/**
 * Traps focus across two disjoint subtrees — the coach card and the externally
 * spotlighted target — which a single-subtree trap (Reka FocusScope) can't model.
 * Tab/Shift+Tab cycle through both, wrapping; the focusin guard pulls stray
 * focus back into the card.
 */
export function useFocusTrap(options: FocusTrapOptions) {
  const { cardRef, getTarget, isSuspended, onEscape } = options

  /** Focus the primary action (the last button); Skip comes first in the DOM. */
  async function focusCard() {
    await nextTick()
    const buttons = cardRef.value?.querySelectorAll<HTMLElement>('button')
    buttons?.[buttons.length - 1]?.focus()
  }

  /** The Tab cycle: the target's focusables, then the card's buttons. */
  function focusCycle(): HTMLElement[] {
    const items: HTMLElement[] = []
    const target = getTarget()
    if (target) {
      if (target.matches(FOCUSABLE)) items.push(target)
      items.push(...target.querySelectorAll<HTMLElement>(FOCUSABLE))
    }
    if (cardRef.value) {
      items.push(...cardRef.value.querySelectorAll<HTMLElement>(FOCUSABLE))
    }
    return items
  }

  useEventListener(
    document,
    'keydown',
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onEscape()
        return
      }
      if (e.key !== 'Tab') return
      const items = focusCycle()
      if (!items.length) return
      e.preventDefault()
      const current = items.indexOf(document.activeElement as HTMLElement)
      // From outside the trap (current === -1): first item on Tab, last on Shift+Tab.
      const nextIdx =
        current === -1
          ? e.shiftKey
            ? items.length - 1
            : 0
          : (current + (e.shiftKey ? -1 : 1) + items.length) % items.length
      items[nextIdx]?.focus()
    },
    { capture: true }
  )

  useEventListener(
    document,
    'focusin',
    (e: FocusEvent) => {
      if (isSuspended()) return
      const node = e.target as Node | null
      if (!node) return
      if (cardRef.value?.contains(node)) return
      if (getTarget()?.contains(node)) return
      void focusCard()
    },
    { capture: true }
  )

  return { focusCard }
}
