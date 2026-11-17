import {
  computed,
  getCurrentScope,
  onScopeDispose,
  shallowRef,
  watch
} from 'vue'

/** How long the pointer rests on her before her card opens as a peek. */
export const HOVER_MENU_OPEN_MS = 900
/** How long a peek stays once the pointer is off both her and the card. */
export const HOVER_MENU_CLOSE_MS = 300

/** How her card was put away: Esc, its close button, or a press anywhere else. */
export type CardDismissal = 'key' | 'button' | 'outside'

/** Where a press on her came from: a pointer, or Enter or Space on her button. */
export type PressSource = 'pointer' | 'keyboard'

type MenuState = 'closed' | 'peeking' | 'pinned'

interface MenuOptions {
  /** True while a click on her would open the card. */
  canOffer: () => boolean
  /** Whether resting on her opens the card too. */
  hover: boolean
}

/**
 * Owns whether her card is open and whether it is pinned.
 *
 * Resting a mouse or pen pointer on her for `HOVER_MENU_OPEN_MS` opens it as a
 * peek, when a click would open it. A peek goes `HOVER_MENU_CLOSE_MS` after the
 * pointer is off both her and the card. A click on her, a press or the focus
 * inside the card pins it: it then stays until it is closed, and closing
 * forgets the pin. Touch and the keyboard never peek.
 */
export function useCompanionMenu({ canOffer, hover }: MenuOptions) {
  const state = shallowRef<MenuState>('closed')
  const byKeyboard = shallowRef(false)
  let overHer = false
  let overCard = false
  let opening: ReturnType<typeof setTimeout> | undefined
  let closing: ReturnType<typeof setTimeout> | undefined

  function stopTimers(): void {
    clearTimeout(opening)
    clearTimeout(closing)
  }

  function close(): void {
    stopTimers()
    // The card is gone, and no leave is heard from an element that is removed.
    overCard = false
    byKeyboard.value = false
    state.value = 'closed'
  }

  function restartClosing(): void {
    clearTimeout(closing)
    if (state.value !== 'peeking' || overHer || overCard) return
    closing = setTimeout(close, HOVER_MENU_CLOSE_MS)
  }

  function herEntered(pointerType: string): void {
    overHer = true
    clearTimeout(closing)
    if (!hover || pointerType === 'touch') return
    if (state.value !== 'closed' || !canOffer()) return
    clearTimeout(opening)
    opening = setTimeout(() => {
      if (state.value === 'closed' && canOffer()) state.value = 'peeking'
    }, HOVER_MENU_OPEN_MS)
  }

  function herLeft(): void {
    overHer = false
    clearTimeout(opening)
    restartClosing()
  }

  function cardEntered(): void {
    overCard = true
    clearTimeout(closing)
  }

  function cardLeft(): void {
    overCard = false
    restartClosing()
  }

  /** She was clicked, or Enter was pressed on her: it opens pinned, a peek is kept, a pinned card closes. */
  function pressed(source: PressSource): void {
    if (state.value === 'pinned') {
      close()
      return
    }
    stopTimers()
    byKeyboard.value = source === 'keyboard'
    state.value = 'pinned'
  }

  /** The person is using the card: a press or the focus inside it keeps a peek open. */
  function engaged(): void {
    if (state.value !== 'peeking') return
    stopTimers()
    state.value = 'pinned'
  }

  watch(
    canOffer,
    (can) => {
      if (!can) close()
    },
    { flush: 'sync' }
  )
  if (getCurrentScope()) onScopeDispose(stopTimers)

  return {
    open: computed(() => state.value !== 'closed'),
    pinned: computed(() => state.value === 'pinned'),
    /** True while the card was opened from the keyboard, which is when focus goes back to her. */
    byKeyboard: computed(() => byKeyboard.value),
    herEntered,
    herLeft,
    cardEntered,
    cardLeft,
    pressed,
    engaged,
    close
  }
}
