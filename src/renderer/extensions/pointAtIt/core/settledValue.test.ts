import { describe, expect, it, onTestFinished, vi } from 'vitest'

import { followSettled } from './settledValue'

const SETTLE_MS = 50

function source(initial: string | null) {
  const changed = new Set<() => void>()
  const state = { value: initial, busy: false }
  const followed = followSettled({
    read: () => state.value,
    isBusy: () => state.busy,
    watch(listener) {
      changed.add(listener)
      return () => changed.delete(listener)
    },
    settleMs: SETTLE_MS
  })
  const listener = vi.fn()
  onTestFinished(followed.onChange(listener))
  function set(value: string | null) {
    state.value = value
    changed.forEach((notify) => notify())
  }
  return { state, followed, listener, set, watchers: changed }
}

describe('followSettled', () => {
  it('HS-03: reports a new value once it has lasted', () => {
    const { followed, listener, set } = source('workflow-w')

    set('workflow-v')
    expect(followed.current()).toBe('workflow-w')

    vi.advanceTimersByTime(SETTLE_MS)
    expect(followed.current()).toBe('workflow-v')
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('HS-03: a value that passes through a throwaway state and comes back is no change', () => {
    const { state, followed, listener, set } = source('workflow-w')

    state.busy = true
    set('throwaway')
    vi.advanceTimersByTime(SETTLE_MS * 10)
    set('workflow-w')
    state.busy = false
    vi.advanceTimersByTime(SETTLE_MS * 2)

    expect(followed.current()).toBe('workflow-w')
    expect(listener).not.toHaveBeenCalled()
  })

  it('HS-03: while the source is busy the last value that lasted stands, however long it takes', () => {
    const { state, followed, listener, set } = source('workflow-w')

    state.busy = true
    set('throwaway')
    vi.advanceTimersByTime(SETTLE_MS * 10)
    expect(followed.current()).toBe('workflow-w')

    set('workflow-v')
    state.busy = false
    vi.advanceTimersByTime(SETTLE_MS * 2)

    expect(followed.current()).toBe('workflow-v')
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('HS-04: starts with no value while the source is busy, and reports the first one that lasts', () => {
    const { state, followed, listener } = source('workflow-w')
    state.busy = true
    const late = followSettled({
      read: () => state.value,
      isBusy: () => state.busy,
      watch: () => () => undefined,
      settleMs: SETTLE_MS
    })
    const heard = vi.fn()
    onTestFinished(late.onChange(heard))
    expect(late.current()).toBeNull()

    state.busy = false
    vi.advanceTimersByTime(SETTLE_MS * 2)

    expect(late.current()).toBe('workflow-w')
    expect(heard).toHaveBeenCalledTimes(1)
    expect(followed.current()).toBe('workflow-w')
    expect(listener).not.toHaveBeenCalled()
  })

  it('stops watching and reporting once removed', () => {
    const { state, watchers } = source('workflow-w')
    const followed = followSettled({
      read: () => state.value,
      isBusy: () => false,
      watch(listener) {
        watchers.add(listener)
        return () => watchers.delete(listener)
      },
      settleMs: SETTLE_MS
    })
    const heard = vi.fn()
    const stop = followed.onChange(heard)

    stop()
    state.value = 'workflow-v'
    vi.advanceTimersByTime(SETTLE_MS * 2)

    expect(heard).not.toHaveBeenCalled()
    expect(watchers.size).toBe(1)
  })
})
