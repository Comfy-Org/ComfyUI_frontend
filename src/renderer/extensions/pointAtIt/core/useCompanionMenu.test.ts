import { describe, expect, it, onTestFinished, vi } from 'vitest'
import { effectScope, shallowRef } from 'vue'

import {
  HOVER_MENU_CLOSE_MS,
  HOVER_MENU_OPEN_MS,
  useCompanionMenu
} from './useCompanionMenu'

function startMenu({ hover = true, offered = true } = {}) {
  const canOffer = shallowRef(offered)
  const scope = effectScope()
  onTestFinished(() => scope.stop())
  const menu = scope.run(() =>
    useCompanionMenu({ canOffer: () => canOffer.value, hover })
  )
  if (!menu) throw new Error('The menu scope is not active')
  return { menu, canOffer, scope }
}

type Menu = ReturnType<typeof startMenu>['menu']

/** The pointer comes onto her and rests there until her card opens. */
function rest(menu: Menu) {
  menu.herEntered('mouse')
  vi.advanceTimersByTime(HOVER_MENU_OPEN_MS)
}

describe('useCompanionMenu: resting on her', () => {
  it('CP-67: opens as a peek once the pointer has rested for the set time, and not before', () => {
    const { menu } = startMenu()

    menu.herEntered('mouse')
    vi.advanceTimersByTime(HOVER_MENU_OPEN_MS - 1)
    expect(menu.open.value).toBe(false)

    vi.advanceTimersByTime(1)

    expect(menu.open.value).toBe(true)
    expect(menu.pinned.value).toBe(false)
  })

  it('CP-67: leaving before that cancels it, and coming back starts the wait again', () => {
    const { menu } = startMenu()

    menu.herEntered('mouse')
    vi.advanceTimersByTime(HOVER_MENU_OPEN_MS - 100)
    menu.herLeft()
    vi.advanceTimersByTime(HOVER_MENU_OPEN_MS * 2)
    expect(menu.open.value).toBe(false)

    menu.herEntered('mouse')
    vi.advanceTimersByTime(HOVER_MENU_OPEN_MS - 1)
    expect(menu.open.value).toBe(false)
    vi.advanceTimersByTime(1)
    expect(menu.open.value).toBe(true)
  })

  it.for([
    { pointerType: 'mouse', peeks: true },
    { pointerType: 'pen', peeks: true },
    { pointerType: 'touch', peeks: false }
  ])(
    'CP-73: a $pointerType pointer peeks: $peeks',
    ({ pointerType, peeks }) => {
      const { menu } = startMenu()

      menu.herEntered(pointerType)
      vi.advanceTimersByTime(HOVER_MENU_OPEN_MS * 2)

      expect(menu.open.value).toBe(peeks)
    }
  )

  it('CP-74: it does not peek when a click would not open the card, at the start or by the time the wait is over', () => {
    const { menu, canOffer } = startMenu({ offered: false })
    rest(menu)
    expect(menu.open.value).toBe(false)
    menu.herLeft()

    canOffer.value = true
    menu.herEntered('mouse')
    vi.advanceTimersByTime(HOVER_MENU_OPEN_MS - 100)
    canOffer.value = false
    vi.advanceTimersByTime(100)

    expect(menu.open.value).toBe(false)
  })

  it('CP-74: an open card goes the moment a click on her would no longer open it', () => {
    const { menu, canOffer } = startMenu()
    menu.pressed('pointer')
    expect(menu.open.value).toBe(true)

    canOffer.value = false

    expect(menu.open.value).toBe(false)
    expect(menu.pinned.value).toBe(false)
  })

  it('CP-76: with the hover menu off nothing peeks, and a click still opens it', () => {
    const { menu } = startMenu({ hover: false })

    rest(menu)
    expect(menu.open.value).toBe(false)
    menu.pressed('pointer')

    expect(menu.pinned.value).toBe(true)
  })

  it('stops waiting when the scope that owns it ends', () => {
    const { menu, scope } = startMenu()
    menu.herEntered('mouse')

    scope.stop()
    vi.advanceTimersByTime(HOVER_MENU_OPEN_MS * 2)

    expect(menu.open.value).toBe(false)
  })
})

describe('useCompanionMenu: a peek going away', () => {
  it('CP-70: closes a set time after the pointer is off her and off the card', () => {
    const { menu } = startMenu()
    rest(menu)

    menu.herLeft()
    vi.advanceTimersByTime(HOVER_MENU_CLOSE_MS - 1)
    expect(menu.open.value).toBe(true)

    vi.advanceTimersByTime(1)
    expect(menu.open.value).toBe(false)
  })

  it('CP-70: moving from her onto the card keeps it, and leaving the card starts the time again', () => {
    const { menu } = startMenu()
    rest(menu)

    menu.herLeft()
    vi.advanceTimersByTime(HOVER_MENU_CLOSE_MS - 100)
    menu.cardEntered()
    vi.advanceTimersByTime(HOVER_MENU_CLOSE_MS * 5)
    expect(menu.open.value).toBe(true)

    menu.cardLeft()
    vi.advanceTimersByTime(HOVER_MENU_CLOSE_MS - 1)
    expect(menu.open.value).toBe(true)
    vi.advanceTimersByTime(1)
    expect(menu.open.value).toBe(false)
  })

  it('CP-70: going back onto her before it is over keeps it, and it stays while she is hovered', () => {
    const { menu } = startMenu()
    rest(menu)

    menu.herLeft()
    vi.advanceTimersByTime(HOVER_MENU_CLOSE_MS - 1)
    menu.herEntered('mouse')
    vi.advanceTimersByTime(HOVER_MENU_CLOSE_MS * 5)

    expect(menu.open.value).toBe(true)
  })

  it('CP-70: a card that was put away while the pointer was on it does not make the next peek stay', () => {
    const { menu } = startMenu()
    rest(menu)
    menu.cardEntered()
    menu.close()
    menu.herLeft()

    rest(menu)
    menu.herLeft()
    vi.advanceTimersByTime(HOVER_MENU_CLOSE_MS)

    expect(menu.open.value).toBe(false)
  })
})

describe('useCompanionMenu: pinning', () => {
  it('CP-69: a click on her opens it pinned, and a click on a peek keeps it instead of closing it', () => {
    const { menu } = startMenu()
    menu.pressed('pointer')
    expect(menu.pinned.value).toBe(true)
    menu.close()

    rest(menu)
    expect(menu.pinned.value).toBe(false)
    menu.pressed('pointer')

    expect(menu.open.value).toBe(true)
    expect(menu.pinned.value).toBe(true)
  })

  it('CP-69: a pinned card does not go when the pointer leaves, and a click on her closes it', () => {
    const { menu } = startMenu()
    rest(menu)
    menu.pressed('pointer')

    menu.herLeft()
    vi.advanceTimersByTime(HOVER_MENU_CLOSE_MS * 5)
    expect(menu.open.value).toBe(true)

    menu.pressed('pointer')
    expect(menu.open.value).toBe(false)
  })

  it('CP-71: a press or the focus inside the card pins a peek; on a card that is closed or pinned it changes nothing', () => {
    const { menu } = startMenu()
    menu.engaged()
    expect(menu.open.value).toBe(false)

    rest(menu)
    menu.herLeft()
    menu.engaged()
    vi.advanceTimersByTime(HOVER_MENU_CLOSE_MS * 5)

    expect(menu.pinned.value).toBe(true)
    menu.engaged()
    expect(menu.pinned.value).toBe(true)
  })

  it('CP-69: a click while the wait is on opens it pinned at once, and the wait does not open it again', () => {
    const { menu } = startMenu()
    menu.herEntered('mouse')
    vi.advanceTimersByTime(HOVER_MENU_OPEN_MS - 100)

    menu.pressed('pointer')
    menu.pressed('pointer')
    vi.advanceTimersByTime(HOVER_MENU_OPEN_MS)

    expect(menu.open.value).toBe(false)
  })

  it('CP-72: closing forgets the pin, so the next peek is a peek again', () => {
    const { menu } = startMenu()
    menu.pressed('pointer')
    menu.close()
    expect(menu.pinned.value).toBe(false)

    menu.herLeft()
    rest(menu)
    expect(menu.pinned.value).toBe(false)
    menu.herLeft()
    vi.advanceTimersByTime(HOVER_MENU_CLOSE_MS)

    expect(menu.open.value).toBe(false)
  })

  it('CP-78: it remembers that it was opened from the keyboard until it is closed', () => {
    const { menu } = startMenu()

    menu.pressed('keyboard')
    expect(menu.byKeyboard.value).toBe(true)
    menu.close()
    expect(menu.byKeyboard.value).toBe(false)

    menu.pressed('pointer')
    expect(menu.byKeyboard.value).toBe(false)
  })
})
