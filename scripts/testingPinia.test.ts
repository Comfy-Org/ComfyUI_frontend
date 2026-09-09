import { defineStore } from 'pinia'
import { expect, it, vi } from 'vitest'
import { onScopeDispose, ref, watch } from 'vue'

it('disposes the global Pinia after the test', ({ onTestFinished }) => {
  const value = ref(0)
  const changed = vi.fn()
  const disposed = vi.fn()
  const useStore = defineStore('testing-pinia-lifecycle', () => {
    watch(value, changed, { flush: 'sync' })
    onScopeDispose(disposed)
    return {}
  })
  useStore()

  value.value++
  expect(changed).toHaveBeenCalledOnce()
  expect(disposed).not.toHaveBeenCalled()

  onTestFinished(() => {
    value.value++
    expect(changed).toHaveBeenCalledOnce()
    expect(disposed).toHaveBeenCalledOnce()
  })
})
