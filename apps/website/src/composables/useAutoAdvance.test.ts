import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'

import { useAutoAdvance } from './useAutoAdvance'

const motion = vi.hoisted(() => ({ reduced: false }))

vi.mock('./useReducedMotion', () => ({
  prefersReducedMotion: () => motion.reduced
}))

function runInScope(fn: () => void): () => void {
  const scope = effectScope()
  scope.run(fn)
  return () => scope.stop()
}

describe('useAutoAdvance', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    motion.reduced = false
  })

  it('advances on the dwell cadence while on screen', () => {
    const onAdvance = vi.fn()

    const stop = runInScope(() =>
      useAutoAdvance({
        onScreen: () => true,
        held: () => false,
        dwellMs: 3000,
        onAdvance
      })
    )

    vi.advanceTimersByTime(2999)
    expect(onAdvance).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(onAdvance).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(3000)
    expect(onAdvance).toHaveBeenCalledTimes(2)

    stop()
  })

  it('holds in place while held, then continues on its own cadence', () => {
    const held = ref(true)
    const onAdvance = vi.fn()

    const stop = runInScope(() =>
      useAutoAdvance({
        onScreen: () => true,
        held,
        dwellMs: 3000,
        onAdvance
      })
    )

    vi.advanceTimersByTime(9000)
    expect(onAdvance).not.toHaveBeenCalled()

    held.value = false
    vi.advanceTimersByTime(3000)
    expect(onAdvance).toHaveBeenCalledTimes(1)

    stop()
  })

  it('stops off screen and picks back up when visible again', async () => {
    const onScreen = ref(true)
    const onAdvance = vi.fn()

    const stop = runInScope(() =>
      useAutoAdvance({
        onScreen,
        held: () => false,
        dwellMs: 3000,
        onAdvance
      })
    )

    onScreen.value = false
    await nextTick()
    vi.advanceTimersByTime(10000)
    expect(onAdvance).not.toHaveBeenCalled()

    onScreen.value = true
    await nextTick()
    vi.advanceTimersByTime(3000)
    expect(onAdvance).toHaveBeenCalledTimes(1)

    stop()
  })

  it('restart() waits a full dwell before the next advance', () => {
    const onAdvance = vi.fn()
    let controls: ReturnType<typeof useAutoAdvance> | undefined

    const stop = runInScope(() => {
      controls = useAutoAdvance({
        onScreen: () => true,
        held: () => false,
        dwellMs: 3000,
        onAdvance
      })
    })

    vi.advanceTimersByTime(2000)
    controls!.restart()

    vi.advanceTimersByTime(2999)
    expect(onAdvance).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(onAdvance).toHaveBeenCalledTimes(1)

    stop()
  })

  it('resume() advances on the shorter fuse', () => {
    const onAdvance = vi.fn()
    let controls: ReturnType<typeof useAutoAdvance> | undefined

    const stop = runInScope(() => {
      controls = useAutoAdvance({
        onScreen: () => true,
        held: () => false,
        dwellMs: 3000,
        resumeMs: 1500,
        onAdvance
      })
    })

    controls!.resume()
    vi.advanceTimersByTime(1500)
    expect(onAdvance).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(3000)
    expect(onAdvance).toHaveBeenCalledTimes(2)

    stop()
  })

  it('never advances under prefers-reduced-motion', () => {
    motion.reduced = true
    const onAdvance = vi.fn()
    let controls: ReturnType<typeof useAutoAdvance> | undefined

    const stop = runInScope(() => {
      controls = useAutoAdvance({
        onScreen: () => true,
        held: () => false,
        dwellMs: 3000,
        onAdvance
      })
    })

    controls!.restart()
    vi.advanceTimersByTime(10000)
    expect(onAdvance).not.toHaveBeenCalled()

    stop()
  })
})
