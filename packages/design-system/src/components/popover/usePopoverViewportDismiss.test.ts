import { DetachedWindowAPI } from 'happy-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'

import { usePopoverViewportDismiss } from './usePopoverViewportDismiss'

const PORTRAIT = { width: 393, height: 851 }
const KEYBOARD_SHOWN = { width: PORTRAIT.width, height: 450 }
const LANDSCAPE = { width: PORTRAIT.height, height: PORTRAIT.width }

function happyDOM(): DetachedWindowAPI {
  const api: unknown = Reflect.get(window, 'happyDOM')
  if (!(api instanceof DetachedWindowAPI))
    throw new Error('window.happyDOM is unavailable')
  return api
}

type Device = 'touch' | 'desktop'
type Focus = 'search input' | 'checkbox' | 'nothing'
type Resize = { width: number; height: number } | 'same-size resize event'

function focusElement(focus: Focus) {
  if (focus === 'nothing') return
  const input = document.createElement('input')
  input.type = focus === 'checkbox' ? 'checkbox' : 'search'
  document.body.append(input)
  input.focus()
}

async function mountOpenPopover(device: Device, focus: Focus) {
  happyDOM().settings.navigator.maxTouchPoints = device === 'touch' ? 5 : 0
  happyDOM().setViewport(PORTRAIT)
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
      when: 'a desktop window is shortened while a search input is focused',
      device: 'desktop',
      focus: 'search input',
      resizeTo: KEYBOARD_SHOWN,
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
    },
    {
      when: 'a resize event keeps the viewport size on a touch device',
      device: 'touch',
      focus: 'search input',
      resizeTo: 'same-size resize event',
      staysOpen: false
    }
  ])(
    'stays open: $staysOpen when $when',
    async ({ device, focus, resizeTo, staysOpen }) => {
      const popover = await mountOpenPopover(device, focus)
      stop = popover.stop

      resize(resizeTo)

      expect(popover.open.value).toBe(staysOpen)
    }
  )

  it('stays open while the on-screen keyboard opens and closes again', async () => {
    const popover = await mountOpenPopover('touch', 'search input')
    stop = popover.stop

    resize(KEYBOARD_SHOWN)
    resize(PORTRAIT)

    expect(popover.open.value).toBe(true)
  })
})
