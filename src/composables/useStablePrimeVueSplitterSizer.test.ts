import type { SplitterResizeEndEvent } from 'primevue/splitter'
import { useStorage } from '@vueuse/core'

import { computed, nextTick, reactive, ref, toValue } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useStablePrimeVueSplitterSizer } from './useStablePrimeVueSplitterSizer'

vi.mock(import('@vueuse/core'), { spy: true })
beforeEach(() => {
  vi.mocked(useStorage).mockImplementation((_key, defaultValue) =>
    ref(defaultValue)
  )
})

function createPanel(width: number) {
  const el = document.createElement('div')
  Object.defineProperty(el, 'offsetWidth', { value: width })
  return ref(el)
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

    trigger.value++
    await flushWatcher()

    expect(panelRef.value.style.flexBasis).toBe('400px')
    expect(panelRef.value.style.flexGrow).toBe('0')
    expect(panelRef.value.style.flexShrink).toBe('0')
  })

  it('does not apply styles when no stored width exists', async () => {
    const panelRef = createPanel(300)
    const trigger = ref(0)

    useStablePrimeVueSplitterSizer(
      [{ ref: panelRef, storageKey: 'test-no-stored' }],
      [trigger]
    )
    await flushWatcher()

    expect(panelRef.value.style.flexBasis).toBe('')
  })

  it('re-applies stored widths when watch sources change', async () => {
    const panelRef = createPanel(500)
    const trigger = ref(0)

    const { onResizeEnd } = useStablePrimeVueSplitterSizer(
      [{ ref: panelRef, storageKey: 'test-reapply' }],
      [trigger]
    )
    await flushWatcher()

    onResizeEnd(resizeEndEvent())

    panelRef.value.style.flexBasis = ''
    panelRef.value.style.flexGrow = ''
    panelRef.value.style.flexShrink = ''

    trigger.value++
    await flushWatcher()

    expect(panelRef.value.style.flexBasis).toBe('500px')
    expect(panelRef.value.style.flexGrow).toBe('0')
    expect(panelRef.value.style.flexShrink).toBe('0')
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
    const panelRef = createPanel(0)
    const trigger = ref(0)
    vi.mocked(useStorage).mockImplementation(() => ref(350))

    const { onResizeEnd } = useStablePrimeVueSplitterSizer(
      [{ ref: panelRef, storageKey: 'test-hidden' }],
      [trigger]
    )
    await flushWatcher()

    onResizeEnd(resizeEndEvent())
    trigger.value++
    await flushWatcher()

    expect(panelRef.value.style.flexBasis).toBe('350px')
  })

  it.for([
    { rendered: 280, captureInitialWidth: true, expected: '280px' },
    { rendered: 280, captureInitialWidth: false, expected: '' },
    { rendered: 0, captureInitialWidth: true, expected: '' }
  ])(
    'pins a panel with no stored width at its rendered width only when opted in and visible ($rendered px, capture $captureInitialWidth)',
    async ({ rendered, captureInitialWidth, expected }) => {
      const panelRef = createPanel(rendered)

      useStablePrimeVueSplitterSizer(
        [{ ref: panelRef, storageKey: 'test-capture-initial' }],
        [ref(0)],
        { captureInitialWidth }
      )
      await flushWatcher()

      expect(panelRef.value.style.flexBasis).toBe(expected)
    }
  )

  it('keeps the captured initial width after the panel is resized by its container', async () => {
    let offsetWidth = 280
    const el = document.createElement('div')
    Object.defineProperty(el, 'offsetWidth', { get: () => offsetWidth })
    const panelRef = ref(el)
    const trigger = ref(0)

    useStablePrimeVueSplitterSizer(
      [{ ref: panelRef, storageKey: 'test-capture-once' }],
      [trigger],
      { captureInitialWidth: true }
    )
    await flushWatcher()

    offsetWidth = 600
    trigger.value++
    await flushWatcher()

    expect(el.style.flexBasis).toBe('280px')
  })

  it('measures a new storage key at the splitter width, not the previous key width', async () => {
    const stored = reactive(new Map<string, number | null>([['tab-a', 350]]))
    vi.mocked(useStorage).mockImplementation((key) =>
      computed({
        get: () => stored.get(toValue(key)) ?? null,
        set: (width) => stored.set(toValue(key), width)
      })
    )
    const el = document.createElement('div')
    el.style.flexBasis = 'calc(20% - 8px)'
    Object.defineProperty(el, 'offsetWidth', {
      get: () => (el.style.flexBasis === '350px' ? 350 : 256)
    })
    const storageKey = ref('tab-a')

    useStablePrimeVueSplitterSizer(
      [{ ref: ref(el), storageKey }],
      [storageKey],
      { captureInitialWidth: true }
    )
    await flushWatcher()
    expect(el.style.flexBasis).toBe('350px')

    storageKey.value = 'tab-b'
    await flushWatcher()

    expect(stored.get('tab-b')).toBe(256)
    expect(el.style.flexBasis).toBe('256px')
  })
})
