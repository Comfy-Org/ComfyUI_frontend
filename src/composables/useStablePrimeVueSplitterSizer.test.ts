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

function createPanel(width: number) {
  const el = document.createElement('div')
  Object.defineProperty(el, 'offsetWidth', { value: width })
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
  it('captures pixel widths on resize end and applies on trigger', async () => {
    const panelRef = createPanel(400)
    const trigger = ref(0)

    const { onResizeEnd } = useStablePrimeVueSplitterSizer(
      [{ ref: panelRef, storageKey: 'test-capture' }],
      [trigger]
    )
    await flushWatcher()

    onResizeEnd(resizeEndEvent())
    panelRef.value.style.flexBasis = ''
    trigger.value++
    await flushWatcher()

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

  it('handles multiple panels independently', async () => {
    const leftRef = createPanel(300)
    const rightRef = createPanel(250)
    const trigger = ref(0)

    const { onResizeEnd } = useStablePrimeVueSplitterSizer(
      [
        { ref: leftRef, storageKey: 'test-multi-left' },
        { ref: rightRef, storageKey: 'test-multi-right' }
      ],
      [trigger]
    )
    await flushWatcher()

    onResizeEnd(resizeEndEvent())
    trigger.value++
    await flushWatcher()

    expect(leftRef.value.style.flexBasis).toBe('300px')
    expect(rightRef.value.style.flexBasis).toBe('250px')
  })

  it('skips panels with null refs', async () => {
    const nullRef = ref(null)
    const validRef = createPanel(200)
    const trigger = ref(0)

    const { onResizeEnd } = useStablePrimeVueSplitterSizer(
      [
        { ref: nullRef, storageKey: 'test-null' },
        { ref: validRef, storageKey: 'test-valid' }
      ],
      [trigger]
    )
    await flushWatcher()

    onResizeEnd(resizeEndEvent())
    trigger.value++
    await flushWatcher()

    expect(validRef.value.style.flexBasis).toBe('200px')
  })

  it('does not overwrite a stored width from a hidden panel on resize end', async () => {
    const stored = useKeyedStorage({ hidden: 350 })
    const panelRef = createPanel(0)

    const { onResizeEnd } = useStablePrimeVueSplitterSizer(
      [{ ref: panelRef, storageKey: 'hidden' }],
      [ref(0)]
    )
    await flushWatcher()
    onResizeEnd(resizeEndEvent())

    expect(stored.get('hidden')).toBe(350)
    expect(panelRef.value.style.flexBasis).toBe('350px')
  })

  it.for([
    { case: 'nothing is stored', storedWidth: undefined, expected: '280px' },
    { case: 'a width is stored', storedWidth: 350, expected: '350px' },
    { case: 'a zero width is stored', storedWidth: 0, expected: '280px' },
    { case: 'a negative width is stored', storedWidth: -40, expected: '280px' },
    {
      case: 'a non-finite width is stored',
      storedWidth: Number.NaN,
      expected: '280px'
    }
  ])(
    'pins the stored width, or the default when $case',
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

      expect(panelRef.value.style.flexBasis).toBe(expected)
      expect(stored.get('panel')).toBe(storedWidth)
    }
  )

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
    expect(stored.has('tab-b')).toBe(false)
  })

  it('saves and re-pins only the panels beside the dragged gutter', async () => {
    const stored = useKeyedStorage({ sidebar: 800, offside: 250 })
    const sidebarRef = createPanel(480)
    const offsideRef = createPanel(300)
    const center = document.createElement('div')
    const sidebarGutter = document.createElement('div')
    const offsideGutter = document.createElement('div')
    sidebarGutter.className = 'p-splitter-gutter'
    offsideGutter.className = 'p-splitter-gutter'
    const handle = document.createElement('div')
    offsideGutter.append(handle)
    document.body.append(
      sidebarRef.value,
      sidebarGutter,
      center,
      offsideGutter,
      offsideRef.value
    )

    const { onResizeStart, onResizeEnd } = useStablePrimeVueSplitterSizer(
      [
        { ref: sidebarRef, storageKey: 'sidebar' },
        { ref: offsideRef, storageKey: 'offside' }
      ],
      [ref(0)]
    )
    await flushWatcher()

    onResizeStart(resizeStartEvent(handle))
    onResizeEnd(resizeEndEvent())

    expect(stored.get('sidebar')).toBe(800)
    expect(sidebarRef.value.style.flexBasis).toBe('800px')
    expect(stored.get('offside')).toBe(300)
    expect(offsideRef.value.style.flexBasis).toBe('300px')
  })

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
