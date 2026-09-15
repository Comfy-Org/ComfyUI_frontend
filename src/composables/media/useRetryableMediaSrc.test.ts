import { effectScope, nextTick, ref, watch } from 'vue'
import type { EffectScope, Ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useRetryableMediaSrc } from './useRetryableMediaSrc'

describe('useRetryableMediaSrc', () => {
  let scope: EffectScope | undefined

  function runWithScope<T>(fn: () => T): T {
    scope = effectScope()
    const result = scope.run(fn)
    if (result === undefined) {
      throw new Error('Effect scope did not run')
    }
    return result
  }

  function trackSource(source: Ref<string | undefined>) {
    return runWithScope(() => {
      const media = useRetryableMediaSrc(source)
      const history = [media.src.value]
      watch(media.src, (value) => history.push(value), { flush: 'sync' })
      return { ...media, history }
    })
  }

  afterEach(() => {
    scope?.stop()
    scope = undefined
  })

  it('binds the source and starts loading', () => {
    const source = ref<string | undefined>('a.mp4')
    const media = trackSource(source)

    expect(media.src.value).toBe('a.mp4')
    expect(media.status.value).toBe('loading')

    source.value = undefined

    expect(media.src.value).toBeUndefined()
    expect(media.status.value).toBe('idle')
  })

  it('re-emits the source after the first delay on error', async () => {
    const source = ref<string | undefined>('a.mp4')
    const media = trackSource(source)

    media.onError()

    expect(media.status.value).toBe('retrying')
    expect(media.src.value).toBe('a.mp4')

    await vi.advanceTimersByTimeAsync(499)
    expect(media.history).toEqual(['a.mp4'])

    await vi.advanceTimersByTimeAsync(1)
    expect(media.history).toEqual(['a.mp4', undefined, 'a.mp4'])
    expect(media.status.value).toBe('loading')
  })

  it('backs off 500, 1000, 2000, 4000, 8000 and fails on the sixth error', async () => {
    const source = ref<string | undefined>('a.mp4')
    const media = trackSource(source)

    for (const delay of [500, 1000, 2000, 4000, 8000]) {
      media.onError()
      await vi.advanceTimersByTimeAsync(delay)
      expect(media.status.value).toBe('loading')
    }

    media.onError()

    expect(media.status.value).toBe('failed')
    expect(media.src.value).toBe('a.mp4')

    const historyAfterFailure = [...media.history]
    await vi.advanceTimersByTimeAsync(60000)
    expect(media.history).toEqual(historyAfterFailure)
  })

  it('ignores errors while retrying or failed', async () => {
    const source = ref<string | undefined>('a.mp4')
    const media = trackSource(source)

    media.onError()
    media.onError()
    await vi.advanceTimersByTimeAsync(500)

    expect(media.history).toHaveLength(3)

    for (const delay of [1000, 2000, 4000, 8000]) {
      media.onError()
      await vi.advanceTimersByTimeAsync(delay)
    }
    media.onError()
    media.onError()

    expect(media.status.value).toBe('failed')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('resets attempts and cancels a pending retry when the source changes', async () => {
    const source = ref<string | undefined>('a.mp4')
    const media = trackSource(source)

    media.onError()
    source.value = 'b.mp4'

    expect(media.src.value).toBe('b.mp4')
    expect(media.status.value).toBe('loading')

    await vi.advanceTimersByTimeAsync(10000)
    expect(media.history).toEqual(['a.mp4', 'b.mp4'])

    media.onError()
    await vi.advanceTimersByTimeAsync(499)
    expect(media.history).toEqual(['a.mp4', 'b.mp4'])

    await vi.advanceTimersByTimeAsync(1)
    expect(media.history.slice(-2)).toEqual([undefined, 'b.mp4'])
  })

  it('retry() resets the attempt budget and reloads immediately', async () => {
    const source = ref<string | undefined>('a.mp4')
    const media = trackSource(source)

    for (const delay of [500, 1000, 2000, 4000, 8000]) {
      media.onError()
      await vi.advanceTimersByTimeAsync(delay)
    }
    media.onError()

    expect(media.status.value).toBe('failed')

    media.retry()
    await nextTick()

    expect(media.history.slice(-2)).toEqual([undefined, 'a.mp4'])
    expect(media.status.value).toBe('loading')

    media.onError()
    await vi.advanceTimersByTimeAsync(499)
    expect(media.status.value).toBe('retrying')

    await vi.advanceTimersByTimeAsync(1)
    expect(media.status.value).toBe('loading')
  })

  it('stops the pending retry when the scope is disposed', async () => {
    const source = ref<string | undefined>('a.mp4')
    const media = runWithScope(() => useRetryableMediaSrc(source))
    const history = [media.src.value]
    const stopHistory = watch(media.src, (value) => history.push(value), {
      flush: 'sync'
    })

    media.onError()
    scope?.stop()

    expect(vi.getTimerCount()).toBe(0)

    await vi.advanceTimersByTimeAsync(10000)
    expect(history).toEqual(['a.mp4'])
    expect(media.src.value).toBe('a.mp4')

    stopHistory()
  })

  it('retry() is a no-op while idle', () => {
    const source = ref<string | undefined>()
    const media = trackSource(source)

    media.retry()

    expect(media.status.value).toBe('idle')
    expect(media.history).toEqual([undefined])
  })
})
