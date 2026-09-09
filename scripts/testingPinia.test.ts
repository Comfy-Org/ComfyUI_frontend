import { createTestingPinia } from '@pinia/testing'
import { defineStore, setActivePinia } from 'pinia'
import { expect, it, vi } from 'vitest'
import { onScopeDispose, ref, watch } from 'vue'

it.for(['global', 'local'])(
  'disposes the %s Pinia after the test',
  (source, { onTestFinished }) => {
    if (source === 'local') setActivePinia(createTestingPinia())

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
  }
)
