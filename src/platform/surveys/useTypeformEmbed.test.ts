import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { effectScope, ref } from 'vue'

import { useTypeformEmbed } from './useTypeformEmbed'

describe('useTypeformEmbed', () => {
  let scope: ReturnType<typeof effectScope>

  function runInScope<T>(fn: () => T): T {
    scope = effectScope()
    return scope.run(fn) as T
  }

  beforeEach(() => {
    scope = effectScope()
  })

  afterEach(() => {
    scope?.stop()
  })

  it('marks alphanumeric ids as valid', () => {
    const containerRef = ref<HTMLElement | null>(null)
    const result = runInScope(() => useTypeformEmbed(containerRef, 'goZLqjKL'))

    expect(result.isValidTypeformId.value).toBe(true)
    expect(result.typeformId.value).toBe('goZLqjKL')
  })

  it('marks ids with non-alphanumeric characters as invalid', () => {
    const containerRef = ref<HTMLElement | null>(null)
    const result = runInScope(() =>
      useTypeformEmbed(containerRef, 'bad id with spaces!')
    )

    expect(result.isValidTypeformId.value).toBe(false)
    expect(result.typeformId.value).toBe('')
  })

  it('marks undefined id as invalid', () => {
    const containerRef = ref<HTMLElement | null>(null)
    const result = runInScope(() => useTypeformEmbed(containerRef, undefined))

    expect(result.isValidTypeformId.value).toBe(false)
    expect(result.typeformId.value).toBe('')
  })

  it('marks empty string id as invalid', () => {
    const containerRef = ref<HTMLElement | null>(null)
    const result = runInScope(() => useTypeformEmbed(containerRef, ''))

    expect(result.isValidTypeformId.value).toBe(false)
    expect(result.typeformId.value).toBe('')
  })

  it('exposes a reactive typeformError ref initialized to false', () => {
    const containerRef = ref<HTMLElement | null>(null)
    const result = runInScope(() => useTypeformEmbed(containerRef, 'goZLqjKL'))

    expect(result.typeformError.value).toBe(false)
  })
})
