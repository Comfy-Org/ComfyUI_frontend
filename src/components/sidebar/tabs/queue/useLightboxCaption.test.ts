import { render } from '@testing-library/vue'
import { defineComponent, nextTick, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import { useLightboxCaption } from './useLightboxCaption'

type Caption = ReturnType<typeof useLightboxCaption>

function setupCaption() {
  const ready = ref(false)
  let caption: Caption | undefined
  render(
    defineComponent({
      setup() {
        caption = useLightboxCaption(() => ready.value)
        return () => null
      }
    })
  )
  if (!caption) throw new Error('caption composable was not created')
  return { ready, caption }
}

describe('useLightboxCaption', () => {
  it('stays hidden until the media is ready', async () => {
    vi.useFakeTimers()
    const { ready, caption } = setupCaption()

    caption.reveal()
    await nextTick()
    expect(caption.visible.value).toBe(false)

    ready.value = true
    await nextTick()
    expect(caption.visible.value).toBe(true)
  })

  it('hides itself two seconds after the reveal', async () => {
    vi.useFakeTimers()
    const { ready, caption } = setupCaption()
    ready.value = true
    await nextTick()

    caption.reveal()
    await nextTick()
    expect(caption.visible.value).toBe(true)

    await vi.advanceTimersByTimeAsync(1999)
    expect(caption.visible.value).toBe(true)

    await vi.advanceTimersByTimeAsync(1)
    expect(caption.visible.value).toBe(false)
  })

  it('stays visible while pinned and hides on unpin', async () => {
    vi.useFakeTimers()
    const { ready, caption } = setupCaption()
    ready.value = true
    await nextTick()

    caption.pin()
    await vi.advanceTimersByTimeAsync(5000)
    await nextTick()
    expect(caption.visible.value).toBe(true)

    caption.unpin()
    await nextTick()
    expect(caption.visible.value).toBe(false)
  })

  it('cancels a pending reveal', async () => {
    vi.useFakeTimers()
    const { ready, caption } = setupCaption()
    ready.value = true
    await nextTick()

    caption.reveal()
    caption.hide()
    await vi.advanceTimersByTimeAsync(5000)
    await nextTick()
    expect(caption.visible.value).toBe(false)
  })

  it('ignores a reveal that was queued before the media was replaced', async () => {
    vi.useFakeTimers()
    const { ready, caption } = setupCaption()

    caption.reveal()
    ready.value = true
    ready.value = false
    await nextTick()
    expect(caption.visible.value).toBe(false)

    ready.value = true
    await nextTick()
    expect(caption.visible.value).toBe(true)
  })
})
