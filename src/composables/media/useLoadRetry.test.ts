import { describe, expect, it } from 'vitest'
import { nextTick, ref } from 'vue'

import { useLoadRetry } from './useLoadRetry'

describe('useLoadRetry', () => {
  it('bumps the retry key when the trigger changes after a failed load', async () => {
    const outputs = ref({})
    const { retryKey, onError, failed } = useLoadRetry(() => outputs.value)
    onError()

    outputs.value = {}
    await nextTick()

    expect(retryKey.value).toBe(1)
    expect(failed.value).toBe(false)
  })

  it('leaves a loaded image alone when the trigger changes', async () => {
    const outputs = ref({})
    const { retryKey } = useLoadRetry(() => outputs.value)

    outputs.value = {}
    await nextTick()

    expect(retryKey.value).toBe(0)
  })
})
