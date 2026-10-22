import { effectScope, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import type {
  EnhancePromptFn,
  EnhancePromptResult
} from '@/workbench/extensions/agent/services/enhancePromptRequest'

import { useEnhancePrompt } from './useEnhancePrompt'

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

describe('useEnhancePrompt', () => {
  it('replaces the prompt after a successful enhance', async () => {
    const prompt = ref('a cat in a field')
    const request = vi.fn<EnhancePromptFn>(async () => ({
      ok: true,
      prompt: 'a tabby cat walking through a golden field'
    }))
    const session = withEnhance({
      prompt,
      request,
      reveal: async ({ text, write }) => {
        write(text)
      }
    })

    await session.enhance()

    expect(prompt.value).toBe('a tabby cat walking through a golden field')
    expect(session.isLocked.value).toBe(false)
    expect(session.isProcessing.value).toBe(false)
    session.stop()
  })

  it('leaves the original prompt unchanged when enhance fails', async () => {
    const prompt = ref('keep this wording')
    const request = vi.fn<EnhancePromptFn>(async () => ({
      ok: false,
      reason: 'failed'
    }))
    const session = withEnhance({
      prompt,
      request,
      reveal: async ({ text, write }) => {
        write(text)
      }
    })

    await session.enhance()

    expect(prompt.value).toBe('keep this wording')
    expect(session.isLocked.value).toBe(false)
    expect(request).toHaveBeenCalledOnce()
    session.stop()
  })

  it('locks the prompt while the enhance request is in flight', async () => {
    const prompt = ref('original prompt')
    const { request, resolve } = deferredEnhance()
    const session = withEnhance({
      prompt,
      request,
      reveal: async ({ text, write }) => {
        write(text)
      }
    })

    const pending = session.enhance()
    expect(session.isLocked.value).toBe(true)
    expect(session.isProcessing.value).toBe(true)
    expect(prompt.value).toBe('original prompt')

    resolve({ ok: true, prompt: 'rewritten prompt' })
    await pending

    expect(session.isLocked.value).toBe(false)
    expect(session.isProcessing.value).toBe(false)
    expect(prompt.value).toBe('rewritten prompt')
    session.stop()
  })
})
