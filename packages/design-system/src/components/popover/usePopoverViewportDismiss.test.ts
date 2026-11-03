import { DetachedWindowAPI } from 'happy-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'

import { usePopoverViewportDismiss } from './usePopoverViewportDismiss'

const PORTRAIT = { width: 393, height: 851 }
const KEYBOARD_SHOWN = { width: PORTRAIT.width, height: 450 }
const LANDSCAPE = { width: PORTRAIT.height, height: PORTRAIT.width }
const KEYBOARD_HIDING = { width: PORTRAIT.width, height: 600 }

function happyDOM(): DetachedWindowAPI {
  const api: unknown = Reflect.get(window, 'happyDOM')
  if (!(api instanceof DetachedWindowAPI))
    throw new Error('window.happyDOM is unavailable')
  return api
}

type Device = 'touch' | 'desktop'
type Focus =
  | 'search input'
  | 'read-only search input'
  | 'keyboardless search input'
  | 'checkbox'
  | 'nothing'
type Resize = { width: number; height: number } | 'same-size resize event'

function focusElement(focus: Focus) {
  if (focus === 'nothing') return
  const input = document.createElement('input')
  input.type = focus === 'checkbox' ? 'checkbox' : 'search'
  input.readOnly = focus === 'read-only search input'
  if (focus === 'keyboardless search input') input.inputMode = 'none'
  document.body.append(input)
  input.focus()
}

async function mountOpenPopover(
  device: Device,
  focus: Focus,
  openedAt: { width: number; height: number } = PORTRAIT
) {
  happyDOM().settings.navigator.maxTouchPoints = device === 'touch' ? 5 : 0
  happyDOM().setViewport(openedAt)
  const anchor = document.createElement('button')
  document.body.append(anchor)
  focusElement(focus)

  const open = ref(false)
  const scope = effectScope()
  scope.run(() => usePopoverViewportDismiss(open, anchor))
  open.value = true
  await nextTick()
  return { open, stop: () => scope.stop() }
}

function moveFocusToButton() {
  const button = document.createElement('button')
  document.body.append(button)
  button.focus()
}

function resize(to: Resize) {
  if (to === 'same-size resize event') window.dispatchEvent(new Event('resize'))
  else happyDOM().setViewport(to)
}

describe(usePopoverViewportDismiss, () => {
  let stop: (() => void) | undefined

  afterEach(() => {
    stop?.()
    happyDOM().settings.navigator.maxTouchPoints = 0
    document.body.replaceChildren()
  })

  it.for<{
    when: string
    device: Device
    focus: Focus
    openedAt?: { width: number; height: number }
    resizeTo: Resize
    staysOpen: boolean
  }>([
    {
      when: 'the on-screen keyboard opens under a focused search input',
      device: 'touch',
      focus: 'search input',
      resizeTo: KEYBOARD_SHOWN,
      staysOpen: true
    },
    {
      when: 'the keyboard that was up when it opened hides',
      device: 'touch',
      focus: 'nothing',
      openedAt: KEYBOARD_SHOWN,
      resizeTo: PORTRAIT,
      staysOpen: true
    },
    {
      when: 'a touch viewport repeats its size with nothing focused',
      device: 'touch',
      focus: 'nothing',
      resizeTo: 'same-size resize event',
      staysOpen: true
    },
    {
      when: 'a desktop window is shortened while a search input is focused',
      device: 'desktop',
      focus: 'search input',
      resizeTo: KEYBOARD_SHOWN,
      staysOpen: false
    },
    {
      when: 'a desktop window repeats its size',
      device: 'desktop',
      focus: 'nothing',
      resizeTo: 'same-size resize event',
      staysOpen: false
    },
    {
      when: 'a touch viewport shortens while a checkbox is focused',
      device: 'touch',
      focus: 'checkbox',
      resizeTo: KEYBOARD_SHOWN,
      staysOpen: false
    },
    {
      when: 'a touch viewport shortens while a read-only input is focused',
      device: 'touch',
      focus: 'read-only search input',
      resizeTo: KEYBOARD_SHOWN,
      staysOpen: false
    },
    {
      when: 'a touch viewport shortens under an input with inputmode none',
      device: 'touch',
      focus: 'keyboardless search input',
      resizeTo: KEYBOARD_SHOWN,
      staysOpen: false
    },
    {
      when: 'a touch viewport shortens with nothing focused',
      device: 'touch',
      focus: 'nothing',
      resizeTo: KEYBOARD_SHOWN,
      staysOpen: false
    },
    {
      when: 'the device rotates while a search input is focused',
      device: 'touch',
      focus: 'search input',
      resizeTo: LANDSCAPE,
      staysOpen: false
    }
  ])(
    'stays open: $staysOpen when $when',
    async ({ device, focus, openedAt, resizeTo, staysOpen }) => {
      const popover = await mountOpenPopover(device, focus, openedAt)
      stop = popover.stop

      resize(resizeTo)

      expect(popover.open.value).toBe(staysOpen)
    }
  )

  it('stays open while the keyboard hides in steps after focus leaves the search input', async () => {
    const popover = await mountOpenPopover('touch', 'search input')
    stop = popover.stop

    resize(KEYBOARD_SHOWN)
    moveFocusToButton()
    resize(KEYBOARD_HIDING)
    resize(PORTRAIT)

    expect(popover.open.value).toBe(true)
  })

  it('closes when the viewport shortens again after the keyboard hid with focus elsewhere', async () => {
    const popover = await mountOpenPopover('touch', 'search input')
    stop = popover.stop

    resize(KEYBOARD_SHOWN)
    moveFocusToButton()
    resize(PORTRAIT)
    resize(KEYBOARD_HIDING)

    expect(popover.open.value).toBe(false)
  })

  it('stays open when a scroll lands in the same frame as the keyboard hiding', async () => {
    const popover = await mountOpenPopover('touch', 'nothing', KEYBOARD_SHOWN)
    stop = popover.stop

    resize(PORTRAIT)
    document.dispatchEvent(new Event('scroll'))

    expect(popover.open.value).toBe(true)
  })

  it('closes on a scroll in a later frame after the keyboard hid', async () => {
    const popover = await mountOpenPopover('touch', 'nothing', KEYBOARD_SHOWN)
    stop = popover.stop

    resize(PORTRAIT)
    await new Promise((resolve) => requestAnimationFrame(resolve))
    document.dispatchEvent(new Event('scroll'))

    expect(popover.open.value).toBe(false)
  })
})
