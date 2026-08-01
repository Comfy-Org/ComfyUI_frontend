import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'
import type { Router } from 'vue-router'

import { useNewVersionReloadPrompt } from './useNewVersionReloadPrompt'

const probeMock = vi.hoisted(() => vi.fn())
const { isIdleRef } = await vi.hoisted(async () => {
  const { ref } = await import('vue')
  return { isIdleRef: ref(true) }
})

vi.mock('./frontendVersionProbe', () => ({
  probeFrontendVersion: probeMock
}))

vi.mock('@/stores/executionStore', () => ({
  useExecutionStore: () => ({
    get isIdle() {
      return isIdleRef.value
    }
  })
}))

const NEWER = 'a-newer-commit'

function driftProbe() {
  probeMock.mockResolvedValue({ version: NEWER, bucket: 'stable' })
}

function matchingProbe() {
  probeMock.mockResolvedValue({
    version: __COMFYUI_FRONTEND_COMMIT__,
    bucket: 'stable'
  })
}

function withScope<T>(fn: () => T): { result: T; stop: () => void } {
  const scope = effectScope()
  const result = scope.run(fn) as T
  return { result, stop: () => scope.stop() }
}

describe('useNewVersionReloadPrompt', () => {
  let showPrompt: ReturnType<typeof vi.fn<() => void>>
  let hidePrompt: ReturnType<typeof vi.fn<() => void>>
  let reload: ReturnType<typeof vi.fn<() => void>>

  beforeEach(() => {
    setActivePinia(createPinia())
    probeMock.mockReset()
    isIdleRef.value = true
    showPrompt = vi.fn<() => void>()
    hidePrompt = vi.fn<() => void>()
    reload = vi.fn<() => void>()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('surfaces the prompt when the desired version drifts and the tab is idle', async () => {
    driftProbe()
    const { result, stop } = withScope(() =>
      useNewVersionReloadPrompt({ showPrompt, hidePrompt, reload })
    )

    await result.checkNow()

    expect(showPrompt).toHaveBeenCalledTimes(1)
    stop()
  })

  it('does not prompt when the versions match', async () => {
    matchingProbe()
    const { result, stop } = withScope(() =>
      useNewVersionReloadPrompt({ showPrompt, hidePrompt, reload })
    )

    await result.checkNow()

    expect(showPrompt).not.toHaveBeenCalled()
    stop()
  })

  it('does not interrupt an active generation, then prompts once idle', async () => {
    driftProbe()
    isIdleRef.value = false
    const { stop } = withScope(() =>
      useNewVersionReloadPrompt({ showPrompt, hidePrompt, reload })
    )

    // Learn about the drift while a generation is running.
    const { useDesiredVersionStore } = await import('./desiredVersionStore')
    await useDesiredVersionStore().refresh()
    await nextTick()
    expect(showPrompt).not.toHaveBeenCalled()

    // Generation finishes → tab goes idle → prompt surfaces.
    isIdleRef.value = true
    await nextTick()
    expect(showPrompt).toHaveBeenCalledTimes(1)
    stop()
  })

  it('reloads and hides the prompt on accept', async () => {
    driftProbe()
    const { result, stop } = withScope(() =>
      useNewVersionReloadPrompt({ showPrompt, hidePrompt, reload })
    )

    await result.checkNow()
    result.accept()

    expect(hidePrompt).toHaveBeenCalledTimes(1)
    expect(reload).toHaveBeenCalledTimes(1)
    stop()
  })

  it('hides the prompt without reloading on dismiss', async () => {
    driftProbe()
    const { result, stop } = withScope(() =>
      useNewVersionReloadPrompt({ showPrompt, hidePrompt, reload })
    )

    await result.checkNow()
    result.dismiss()

    expect(hidePrompt).toHaveBeenCalledTimes(1)
    expect(reload).not.toHaveBeenCalled()
    stop()
  })

  it('only surfaces the prompt once per session', async () => {
    driftProbe()
    const { result, stop } = withScope(() =>
      useNewVersionReloadPrompt({ showPrompt, hidePrompt, reload })
    )

    await result.checkNow()
    await result.checkNow()

    expect(showPrompt).toHaveBeenCalledTimes(1)
    stop()
  })

  it('re-probes and prompts when the window regains focus', async () => {
    driftProbe()
    const { stop } = withScope(() =>
      useNewVersionReloadPrompt({ showPrompt, hidePrompt, reload })
    )

    expect(showPrompt).not.toHaveBeenCalled()

    window.dispatchEvent(new Event('focus'))
    await nextTick()
    await Promise.resolve()
    await nextTick()

    expect(probeMock).toHaveBeenCalled()
    expect(showPrompt).toHaveBeenCalledTimes(1)
    stop()
  })

  it('installs a one-shot navigation guard that reloads on next nav', async () => {
    driftProbe()
    const beforeEach = vi.fn()
    const router = { beforeEach } as unknown as Router

    const { result, stop } = withScope(() =>
      useNewVersionReloadPrompt({ showPrompt, hidePrompt, reload, router })
    )

    await result.checkNow()
    expect(beforeEach).toHaveBeenCalledTimes(1)

    // Simulate the next navigation.
    const guard = beforeEach.mock.calls[0][0] as () => unknown
    const outcome = guard()

    expect(reload).toHaveBeenCalledTimes(1)
    expect(outcome).toBe(false)
    stop()
  })
})
