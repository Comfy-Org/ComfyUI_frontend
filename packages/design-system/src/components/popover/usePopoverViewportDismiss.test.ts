import { DetachedWindowAPI } from 'happy-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'

import { usePopoverViewportDismiss } from './usePopoverViewportDismiss'

const PORTRAIT = { width: 393, height: 851 }
const KEYBOARD_SHOWN = { width: PORTRAIT.width, height: 450 }
const LANDSCAPE = { width: PORTRAIT.height, height: PORTRAIT.width }
const TALLER = { width: PORTRAIT.width, height: 900 }
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
  return { open, anchor, stop: () => scope.stop() }
}

function moveFocusToButton() {
  const button = document.createElement('button')
  document.body.append(button)
  button.focus()
}

function popupScroller() {
  const scroller = document.createElement('div')
  Object.defineProperty(scroller, 'scrollHeight', { value: 1000 })
  Object.defineProperty(scroller, 'clientHeight', { value: 400 })
  document.body.append(scroller)
  return {
    scrollToEnd() {
      scroller.scrollTop = 600
      scroller.dispatchEvent(new Event('scroll'))
    }
  }
}

function viewportScroller(contentHeight: number, chromeHeight: number) {
  let height = contentHeight
  const element = document.createElement('section')
  Object.defineProperty(element, 'scrollHeight', { get: () => height })
  Object.defineProperty(element, 'clientHeight', {
    get: () => window.innerHeight - chromeHeight
  })
  function scrollTo(top: number) {
    element.scrollTop = top
    element.dispatchEvent(new Event('scroll'))
  }
  return {
    element,
    scrollTo,
    scrollToEnd: () => scrollTo(height - element.clientHeight),
    addContent(extra: number) {
      height += extra
    }
  }
}

async function mountOpenPopoverInWidgetList(
  listScrollTop: number,
  { listContentHeight = 1000 } = {}
) {
  happyDOM().settings.navigator.maxTouchPoints = 5
  happyDOM().setViewport(KEYBOARD_SHOWN)
  const panel = viewportScroller(1500, 10)
  const list = viewportScroller(listContentHeight, 50)
  const anchor = document.createElement('button')
  list.element.append(anchor)
  panel.element.append(list.element)
  document.body.append(panel.element)
  panel.element.scrollTop = 1000
  list.element.scrollTop = listScrollTop

  const open = ref(false)
  const scope = effectScope()
  scope.run(() => usePopoverViewportDismiss(open, anchor))
  open.value = true
  await nextTick()

  return {
    open,
    stop: () => scope.stop(),
    scrollListTo: list.scrollTo,
    scrollListToEnd: list.scrollToEnd,
    addListContent: list.addContent,
    scrollPanelToEnd: panel.scrollToEnd
  }
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

  it('stays open when the widget list clamps its scroll as the keyboard hides', async () => {
    const popover = await mountOpenPopoverInWidgetList(600)
    stop = popover.stop

    resize(PORTRAIT)
    popover.scrollListToEnd()

    expect(popover.open.value).toBe(true)
  })

  it('closes on a scroll to the end after a growth that clamped nothing', async () => {
    const popover = await mountOpenPopoverInWidgetList(0)
    stop = popover.stop

    resize(PORTRAIT)
    popover.scrollListToEnd()

    expect(popover.open.value).toBe(false)
  })

  it('closes on a scroll short of the end after the keyboard hides', async () => {
    const popover = await mountOpenPopoverInWidgetList(600)
    stop = popover.stop

    resize(PORTRAIT)
    popover.scrollListTo(100)

    expect(popover.open.value).toBe(false)
  })

  it('closes on the next scroll after the clamp', async () => {
    const popover = await mountOpenPopoverInWidgetList(600)
    stop = popover.stop

    resize(PORTRAIT)
    popover.scrollListToEnd()
    popover.scrollListToEnd()

    expect(popover.open.value).toBe(false)
  })

  it('closes on a clamp the viewport did not cause', async () => {
    const popover = await mountOpenPopoverInWidgetList(600)
    stop = popover.stop

    resize('same-size resize event')
    popover.addListContent(-500)
    popover.scrollListToEnd()

    expect(popover.open.value).toBe(false)
  })

  it('closes on a later clamp the viewport did not cause', async () => {
    const popover = await mountOpenPopoverInWidgetList(600)
    stop = popover.stop
    resize(PORTRAIT)
    popover.scrollListToEnd()

    popover.addListContent(-100)
    popover.scrollListToEnd()

    expect(popover.open.value).toBe(false)
  })

  it('forgets a pending clamp when the popover reopens', async () => {
    const popover = await mountOpenPopoverInWidgetList(600)
    stop = popover.stop
    resize(PORTRAIT)
    popover.open.value = false
    await nextTick()

    popover.open.value = true
    await nextTick()
    popover.scrollListToEnd()

    expect(popover.open.value).toBe(false)
  })

  it('measures the next clamp from where the last clamp left the list', async () => {
    const popover = await mountOpenPopoverInWidgetList(600)
    stop = popover.stop
    resize(PORTRAIT)
    popover.scrollListToEnd()
    popover.addListContent(152)

    resize(TALLER)
    popover.scrollListToEnd()

    expect(popover.open.value).toBe(false)
  })

  it('stays open when the panel and the widget list both clamp as the keyboard hides', async () => {
    const popover = await mountOpenPopoverInWidgetList(600)
    stop = popover.stop

    resize(PORTRAIT)
    popover.scrollPanelToEnd()
    popover.scrollListToEnd()

    expect(popover.open.value).toBe(true)
  })

  it('stays open when the widget list clamps at each step of the keyboard hiding', async () => {
    const popover = await mountOpenPopoverInWidgetList(600)
    stop = popover.stop

    resize(KEYBOARD_HIDING)
    popover.scrollListToEnd()
    resize(PORTRAIT)
    popover.scrollListToEnd()

    expect(popover.open.value).toBe(true)
  })

  it('stays open when a repeated resize arrives before the clamp', async () => {
    const popover = await mountOpenPopoverInWidgetList(600)
    stop = popover.stop

    resize(PORTRAIT)
    resize('same-size resize event')
    popover.scrollListToEnd()

    expect(popover.open.value).toBe(true)
  })

  it('stays open when the clamp lands 1px short of the computed maximum', async () => {
    const popover = await mountOpenPopoverInWidgetList(600, {
      listContentHeight: 1001
    })
    stop = popover.stop

    resize(PORTRAIT)
    popover.scrollListTo(199)

    expect(popover.open.value).toBe(true)
  })

  it('stays open when the popup content clamps before the widget list as the keyboard hides', async () => {
    const popover = await mountOpenPopoverInWidgetList(600)
    stop = popover.stop
    const popupContent = popupScroller()

    resize(PORTRAIT)
    popupContent.scrollToEnd()
    popover.scrollListToEnd()

    expect(popover.open.value).toBe(true)
  })
})
