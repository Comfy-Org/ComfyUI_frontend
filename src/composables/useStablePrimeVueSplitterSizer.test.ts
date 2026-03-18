import type { SplitterResizeEndEvent } from 'primevue/splitter'

import { nextTick, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import { useStablePrimeVueSplitterSizer } from './useStablePrimeVueSplitterSizer'

vi.mock('@vueuse/core', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...(actual as object),
    useStorage: <T>(_key: string, defaultValue: T) => ref(defaultValue)
  }
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

    expect(panelRef.value!.style.flexBasis).toBe('400px')
    expect(panelRef.value!.style.flexGrow).toBe('0')
    expect(panelRef.value!.style.flexShrink).toBe('0')
  })

  it('does not apply styles when no stored width exists', async () => {
    const panelRef = createPanel(300)
    const trigger = ref(0)

    useStablePrimeVueSplitterSizer(
      [{ ref: panelRef, storageKey: 'test-no-stored' }],
      [trigger]
    )
    await flushWatcher()

    expect(panelRef.value!.style.flexBasis).toBe('')
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

    panelRef.value!.style.flexBasis = ''
    panelRef.value!.style.flexGrow = ''
    panelRef.value!.style.flexShrink = ''

    trigger.value++
    await flushWatcher()

    expect(panelRef.value!.style.flexBasis).toBe('500px')
    expect(panelRef.value!.style.flexGrow).toBe('0')
    expect(panelRef.value!.style.flexShrink).toBe('0')
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

    expect(leftRef.value!.style.flexBasis).toBe('300px')
    expect(rightRef.value!.style.flexBasis).toBe('250px')
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

    expect(validRef.value!.style.flexBasis).toBe('200px')
  })
})
