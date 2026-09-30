import type {
  SplitterResizeEndEvent,
  SplitterResizeStartEvent
} from 'primevue/splitter'
import { useStorage } from '@vueuse/core'

import { computed, nextTick, reactive, ref, toValue } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useStablePrimeVueSplitterSizer } from './useStablePrimeVueSplitterSizer'

vi.mock(import('@vueuse/core'), { spy: true })
beforeEach(() => {
  vi.mocked(useStorage).mockImplementation((_key, defaultValue) =>
    ref(defaultValue)
  )
})
afterEach(() => {
  document.body.replaceChildren()
})

function setRenderedWidth(el: HTMLElement, width: number) {
  Object.defineProperty(el, 'offsetWidth', {
    value: width,
    configurable: true
  })
}

function createPanel(width: number) {
  const el = document.createElement('div')
  setRenderedWidth(el, width)
  return ref(el)
}

function useKeyedStorage(initial: Record<string, number>) {
  const stored = reactive(
    new Map<string, number | null>(Object.entries(initial))
  )
  vi.mocked(useStorage).mockImplementation((key) =>
    computed({
      get: () => stored.get(toValue(key)) ?? null,
      set: (width) => stored.set(toValue(key), width)
    })
  )
  return stored
}

function gutterHandleBetween(before: Element, after: Element) {
  const gutter = document.createElement('div')
  gutter.className = 'p-splitter-gutter'
  const handle = document.createElement('div')
  gutter.append(handle)
  document.body.append(before, gutter, after)
  return handle
}

function resizeStartEvent(target: Element): SplitterResizeStartEvent {
  const event = new MouseEvent('mousedown')
  Object.defineProperty(event, 'target', { value: target })
  return { originalEvent: event, sizes: [] }
}

function resizeEndEvent(): SplitterResizeEndEvent {
  return { originalEvent: new Event('mouseup'), sizes: [] }
}

async function flushWatcher() {
  await nextTick()
  await nextTick()
}

describe('useStablePrimeVueSplitterSizer', () => {
  it('saves a dragged width and re-applies it on trigger', async () => {
    const stored = useKeyedStorage({})
    const panelRef = createPanel(300)
    const trigger = ref(0)
    const { onResizeStart, onResizeEnd } = useStablePrimeVueSplitterSizer(
      [{ ref: panelRef, storageKey: 'panel' }],
      [trigger]
    )
    await flushWatcher()

    onResizeStart(
      resizeStartEvent(
        gutterHandleBetween(panelRef.value, document.createElement('div'))
      )
    )
    setRenderedWidth(panelRef.value, 400)
    onResizeEnd(resizeEndEvent())
    panelRef.value.style.flexBasis = ''
    trigger.value++
    await flushWatcher()

    expect(stored.get('panel')).toBe(400)
    expect(panelRef.value.style.flexBasis).toBe('400px')
    expect(panelRef.value.style.flexGrow).toBe('0')
    expect(panelRef.value.style.flexShrink).toBe('0')
  })

  it('does not apply styles when no stored or default width exists', async () => {
    const panelRef = createPanel(300)

    useStablePrimeVueSplitterSizer(
      [{ ref: panelRef, storageKey: 'test-no-stored' }],
      [ref(0)]
    )
    await flushWatcher()

    expect(panelRef.value.style.flexBasis).toBe('')
  })

  it.for([
    { case: 'nothing is stored', storedWidth: undefined, expected: 280 },
    { case: 'a width is stored', storedWidth: 350, expected: 350 },
    { case: 'a zero width is stored', storedWidth: 0, expected: 280 },
    { case: 'a negative width is stored', storedWidth: -40, expected: 280 },
    {
      case: 'a non-finite width is stored',
      storedWidth: Number.NaN,
      expected: 280
    }
  ])(
    'pins and stores the stored width, or the default when $case',
    async ({ storedWidth, expected }) => {
      const stored = useKeyedStorage(
        storedWidth === undefined ? {} : { panel: storedWidth }
      )
      const panelRef = createPanel(500)

      useStablePrimeVueSplitterSizer(
        [{ ref: panelRef, storageKey: 'panel', defaultWidth: () => 280 }],
        [ref(0)]
      )
      await flushWatcher()

      expect(panelRef.value.style.flexBasis).toBe(`${expected}px`)
      expect(stored.get('panel')).toBe(expected)
    }
  )

  it('does not compute a default for a panel that is not rendered', async () => {
    const defaultWidth = vi.fn(() => 280)

    useStablePrimeVueSplitterSizer(
      [{ ref: ref(null), storageKey: 'panel', defaultWidth }],
      [ref(0)]
    )
    await flushWatcher()

    expect(defaultWidth).not.toHaveBeenCalled()
  })

  it('pins a new storage key at its own default, not the previous key width', async () => {
    const stored = useKeyedStorage({ 'tab-a': 350 })
    const panelRef = createPanel(350)
    const storageKey = ref('tab-a')

    useStablePrimeVueSplitterSizer(
      [{ ref: panelRef, storageKey, defaultWidth: () => 280 }],
      [storageKey]
    )
    await flushWatcher()
    storageKey.value = 'tab-b'
    await flushWatcher()

    expect(panelRef.value.style.flexBasis).toBe('280px')
    expect(stored.get('tab-a')).toBe(350)
    expect(stored.get('tab-b')).toBe(280)
  })

  it('saves and re-pins only the panels beside the dragged gutter', async () => {
    const stored = useKeyedStorage({ sidebar: 800, offside: 250 })
    const sidebarRef = createPanel(480)
    const offsideRef = createPanel(250)
    const center = document.createElement('div')
    const sidebarGutter = document.createElement('div')
    sidebarGutter.className = 'p-splitter-gutter'
    document.body.append(sidebarRef.value, sidebarGutter)
    const handle = gutterHandleBetween(center, offsideRef.value)
    const { onResizeStart, onResizeEnd } = useStablePrimeVueSplitterSizer(
      [
        { ref: sidebarRef, storageKey: 'sidebar' },
        { ref: offsideRef, storageKey: 'offside' }
      ],
      [ref(0)]
    )
    await flushWatcher()

    onResizeStart(resizeStartEvent(handle))
    setRenderedWidth(sidebarRef.value, 470)
    setRenderedWidth(offsideRef.value, 300)
    onResizeEnd(resizeEndEvent())

    expect(stored.get('sidebar')).toBe(800)
    expect(sidebarRef.value.style.flexBasis).toBe('800px')
    expect(stored.get('offside')).toBe(300)
    expect(offsideRef.value.style.flexBasis).toBe('300px')
  })

  it.for([
    { case: 'no resize start was seen', start: false, width: 480, key: 'a' },
    { case: 'the width did not change', start: true, width: 480, key: 'a' },
    { case: 'the panel is hidden', start: true, width: 0, key: 'a' },
    { case: 'the storage key changed', start: true, width: 520, key: 'b' }
  ])(
    'keeps the stored width when a resize ends and $case',
    async ({ start, width, key }) => {
      const stored = useKeyedStorage({ a: 800, b: 800 })
      const panelRef = createPanel(480)
      const storageKey = ref('a')
      const handle = gutterHandleBetween(
        panelRef.value,
        document.createElement('div')
      )
      const { onResizeStart, onResizeEnd } = useStablePrimeVueSplitterSizer(
        [{ ref: panelRef, storageKey }],
        [ref(0)]
      )
      await flushWatcher()

      if (start) onResizeStart(resizeStartEvent(handle))
      setRenderedWidth(panelRef.value, width)
      storageKey.value = key
      onResizeEnd(resizeEndEvent())

      expect(stored.get('a')).toBe(800)
      expect(stored.get('b')).toBe(800)
    }
  )

  it('reads a width persisted by a previous session', async () => {
    vi.mocked(useStorage).mockRestore()
    localStorage.setItem('test-persisted-width', '350')
    const panelRef = createPanel(280)

    useStablePrimeVueSplitterSizer(
      [
        {
          ref: panelRef,
          storageKey: 'test-persisted-width',
          defaultWidth: () => 200
        }
      ],
      [ref(0)]
    )
    await flushWatcher()

    expect(panelRef.value.style.flexBasis).toBe('350px')
    expect(localStorage.getItem('test-persisted-width')).toBe('350')
  })
})
