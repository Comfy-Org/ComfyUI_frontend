// @vitest-environment node
import { defineStore, setActivePinia } from 'pinia'
import { expect, it, vi } from 'vitest'
import { onScopeDispose, ref, watch } from 'vue'

it('disposes its Pinia even when the active instance is cleared', ({
  onTestFinished
}) => {
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

  setActivePinia(undefined)
})
