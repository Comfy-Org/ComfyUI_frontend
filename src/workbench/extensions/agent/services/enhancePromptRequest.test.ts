import { describe, expect, it, vi } from 'vitest'

import { enhancePromptRequest } from './enhancePromptRequest'

const STUB_SUFFIX =
  ' — enhanced with richer lighting, camera language, and material detail.'

describe('enhancePromptRequest', () => {
  it.for([
    {
      name: 'plain prompt',
      prompt: '  a cinematic shot  ',
      expected: `a cinematic shot${STUB_SUFFIX}`
    },
    {
      name: 'already enhanced prompt',
      prompt: `a cinematic shot${STUB_SUFFIX}`,
      expected: `a cinematic shot${STUB_SUFFIX}`
    },
    {
      name: 'suffix already stacked twice',
      prompt: `a cinematic shot${STUB_SUFFIX}${STUB_SUFFIX}`,
      expected: `a cinematic shot${STUB_SUFFIX}`
    }
  ])(
    'appends the stub suffix once for a $name',
    async ({ prompt, expected }) => {
      vi.useFakeTimers()
      const pending = enhancePromptRequest({ prompt })
      await vi.advanceTimersByTimeAsync(1200)
      await expect(pending).resolves.toEqual({
        ok: true,
        prompt: expected
      })
    }
  )

  it('rejects an empty prompt without appending the suffix', async () => {
    vi.useFakeTimers()
    const pending = enhancePromptRequest({ prompt: '   ' })
    await vi.advanceTimersByTimeAsync(1200)
    await expect(pending).resolves.toEqual({
      ok: false,
      reason: 'empty'
    })
  })
})
