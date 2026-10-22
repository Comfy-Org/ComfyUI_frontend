import { usePreferredReducedMotion } from '@vueuse/core'
import { computed, effectScope, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  splitWords,
  spokenTextDurationMs,
  wordRevealStaggerMs
} from '@/components/SpokenText/speechTiming'
import { toNodeId } from '@/types/nodeId'
import { widgetId } from '@/types/widgetId'
import type {
  EnhancePromptFn,
  EnhancePromptResult
} from '@/workbench/extensions/agent/services/enhancePromptRequest'

import { useEnhancePrompt } from './useEnhancePrompt'

vi.mock(import('@vueuse/core'), { spy: true })

function deferredEnhance() {
  let resolveRequest: (result: EnhancePromptResult) => void = () => undefined
  const request = vi.fn<EnhancePromptFn>(
    () =>
      new Promise((resolve) => {
        resolveRequest = resolve
      })
  )
  return {
    request,
    resolve: (result: EnhancePromptResult) => resolveRequest(result)
  }
}

function withEnhance(options: Parameters<typeof useEnhancePrompt>[0]) {
  const scope = effectScope()
  const api = scope.run(() => useEnhancePrompt(options))
  if (!api) throw new TypeError('useEnhancePrompt did not start')
  return { ...api, stop: () => scope.stop() }
}

function allowMotion() {
  vi.mocked(usePreferredReducedMotion).mockReturnValue(
    computed(() => 'no-preference')
  )
}

describe('useEnhancePrompt', () => {
  afterEach(() => {
    document.documentElement.classList.remove('disable-animations')
    allowMotion()
  })

  it('holds the shimmer for at least 250ms before revealing', async () => {
    vi.useFakeTimers()
    allowMotion()
    const prompt = ref('original prompt')
    const request = vi.fn<EnhancePromptFn>(async () => ({
      ok: true,
      prompt: 'brand new prompt'
    }))
    const session = withEnhance({ prompt, request })
    const pending = session.enhance()

    expect(session.isProcessing.value).toBe(true)
    expect(prompt.value).toBe('original prompt')

    await vi.advanceTimersByTimeAsync(249)
    expect(session.isProcessing.value).toBe(true)
    expect(session.isRevealing.value).toBe(false)
    expect(prompt.value).toBe('original prompt')

    await vi.advanceTimersByTimeAsync(1)
    expect(session.isProcessing.value).toBe(false)
    expect(session.isRevealing.value).toBe(true)
    expect(prompt.value).toBe('original prompt')

    await vi.advanceTimersByTimeAsync(
      spokenTextDurationMs(
        'brand new prompt',
        0,
        wordRevealStaggerMs(splitWords('brand new prompt').length)
      )
    )
    await pending

    expect(prompt.value).toBe('brand new prompt')
    expect(session.isLocked.value).toBe(false)
    session.stop()
  })

  it('writes the prompt once when the reveal ends', async () => {
    vi.useFakeTimers()
    allowMotion()
    const writes: string[] = []
    const source = ref('original prompt')
    const prompt = computed({
      get: () => source.value,
      set: (value: string) => {
        writes.push(value)
        source.value = value
      }
    })
    const request = vi.fn<EnhancePromptFn>(async () => ({
      ok: true,
      prompt: 'brand new prompt'
    }))
    const session = withEnhance({ prompt, request })
    const pending = session.enhance()

    await vi.advanceTimersByTimeAsync(250)
    expect(writes).toEqual([])
    expect(session.revealText.value).toBe('brand new prompt')

    await vi.advanceTimersByTimeAsync(
      spokenTextDurationMs(
        'brand new prompt',
        0,
        wordRevealStaggerMs(splitWords('brand new prompt').length)
      )
    )
    await pending

    expect(writes).toEqual(['brand new prompt'])
    session.stop()
  })

  it('swaps the text in immediately when motion is reduced', async () => {
    vi.mocked(usePreferredReducedMotion).mockReturnValue(
      computed(() => 'reduce')
    )
    const prompt = ref('original prompt')
    const request = vi.fn<EnhancePromptFn>(async () => ({
      ok: true,
      prompt: 'brand new prompt'
    }))
    const session = withEnhance({ prompt, request })

    await session.enhance()

    expect(prompt.value).toBe('brand new prompt')
    expect(session.isRevealing.value).toBe(false)
    expect(session.isLocked.value).toBe(false)
    session.stop()
  })

  it('swaps the text in immediately when animations are disabled', async () => {
    allowMotion()
    document.documentElement.classList.add('disable-animations')
    const prompt = ref('original prompt')
    const request = vi.fn<EnhancePromptFn>(async () => ({
      ok: true,
      prompt: 'brand new prompt'
    }))
    const session = withEnhance({ prompt, request })

    await session.enhance()

    expect(prompt.value).toBe('brand new prompt')
    expect(session.isRevealing.value).toBe(false)
    session.stop()
  })

  it('leaves the original prompt unchanged when enhance fails', async () => {
    vi.useFakeTimers()
    allowMotion()
    const prompt = ref('keep this wording')
    const request = vi.fn<EnhancePromptFn>(async () => ({
      ok: false,
      reason: 'failed'
    }))
    const session = withEnhance({ prompt, request })
    const pending = session.enhance()

    await vi.advanceTimersByTimeAsync(250)
    await pending

    expect(prompt.value).toBe('keep this wording')
    expect(session.isLocked.value).toBe(false)
    expect(request).toHaveBeenCalledOnce()
    session.stop()
  })

  it('locks the prompt while the enhance request is in flight', async () => {
    vi.useFakeTimers()
    allowMotion()
    const prompt = ref('original prompt')
    const { request, resolve } = deferredEnhance()
    const session = withEnhance({ prompt, request })

    const pending = session.enhance()
    expect(session.isLocked.value).toBe(true)
    expect(session.isProcessing.value).toBe(true)
    expect(prompt.value).toBe('original prompt')

    resolve({ ok: true, prompt: 'rewritten prompt' })
    await vi.advanceTimersByTimeAsync(250)
    expect(session.isRevealing.value).toBe(true)
    expect(prompt.value).toBe('original prompt')

    await vi.advanceTimersByTimeAsync(
      spokenTextDurationMs(
        'rewritten prompt',
        0,
        wordRevealStaggerMs(splitWords('rewritten prompt').length)
      )
    )
    await pending

    expect(session.isLocked.value).toBe(false)
    expect(session.isProcessing.value).toBe(false)
    expect(prompt.value).toBe('rewritten prompt')
    session.stop()
  })

  it('shares processing and reveal state for the same widget id', async () => {
    vi.useFakeTimers()
    allowMotion()
    const id = widgetId('story-graph', toNodeId(1), 'prompt')
    const panel = ref('original prompt')
    const canvas = ref('original prompt')
    const { request, resolve } = deferredEnhance()
    const panelSession = withEnhance({ prompt: panel, request, widgetId: id })
    const canvasSession = withEnhance({ prompt: canvas, request, widgetId: id })

    const pending = panelSession.enhance()
    expect(panelSession.isProcessing.value).toBe(true)
    expect(canvasSession.isProcessing.value).toBe(true)
    expect(canvasSession.isLocked.value).toBe(true)

    await canvasSession.enhance()
    expect(request).toHaveBeenCalledOnce()

    resolve({ ok: true, prompt: 'rewritten prompt' })
    await vi.advanceTimersByTimeAsync(250)
    expect(panelSession.isRevealing.value).toBe(true)
    expect(canvasSession.isRevealing.value).toBe(true)
    expect(panelSession.revealText.value).toBe('rewritten prompt')
    expect(canvasSession.revealText.value).toBe('rewritten prompt')
    expect(panel.value).toBe('original prompt')
    expect(canvas.value).toBe('original prompt')

    await vi.advanceTimersByTimeAsync(
      spokenTextDurationMs(
        'rewritten prompt',
        0,
        wordRevealStaggerMs(splitWords('rewritten prompt').length)
      )
    )
    await pending

    expect(panel.value).toBe('rewritten prompt')
    expect(canvas.value).toBe('rewritten prompt')
    expect(panelSession.isLocked.value).toBe(false)
    expect(canvasSession.isLocked.value).toBe(false)
    panelSession.stop()
    canvasSession.stop()
  })

  function scrolledPrompt(scrollTop: number) {
    const textarea = document.createElement('textarea')
    document.body.append(textarea)
    const source = ref('original prompt')
    const prompt = computed({
      get: () => source.value,
      set: (value: string) => {
        source.value = value
        textarea.scrollTop = 0
      }
    })
    textarea.scrollTop = scrollTop
    return { textarea, prompt }
  }

  it('preserves the textarea scroll position when the enhanced prompt is written', async () => {
    vi.useFakeTimers()
    allowMotion()
    const { textarea, prompt } = scrolledPrompt(64)
    const request = vi.fn<EnhancePromptFn>(async () => ({
      ok: true,
      prompt: 'brand new prompt'
    }))
    const session = withEnhance({ prompt, request, textarea })
    const pending = session.enhance()

    await vi.advanceTimersByTimeAsync(250)
    textarea.scrollTop = 64
    await vi.advanceTimersByTimeAsync(
      spokenTextDurationMs(
        'brand new prompt',
        0,
        wordRevealStaggerMs(splitWords('brand new prompt').length)
      )
    )
    await pending

    expect(prompt.value).toBe('brand new prompt')
    expect(textarea.scrollTop).toBe(64)
    textarea.remove()
    session.stop()
  })

  it('preserves scroll when reduced motion writes the prompt immediately', async () => {
    vi.mocked(usePreferredReducedMotion).mockReturnValue(
      computed(() => 'reduce')
    )
    const { textarea, prompt } = scrolledPrompt(48)
    const request = vi.fn<EnhancePromptFn>(async () => ({
      ok: true,
      prompt: 'brand new prompt'
    }))
    const session = withEnhance({ prompt, request, textarea })

    await session.enhance()

    expect(prompt.value).toBe('brand new prompt')
    expect(textarea.scrollTop).toBe(48)
    textarea.remove()
    session.stop()
  })
})
