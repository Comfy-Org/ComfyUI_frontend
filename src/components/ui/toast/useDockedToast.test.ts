import { describe, expect, it } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'

import { useDockedToast } from './useDockedToast'
import { useToast } from './toastStore'

const panel = { template: '<div>Downloads</div>' }

describe('useDockedToast', () => {
  it('docks the panel only while its owner reports work', async () => {
    const visible = ref(false)
    effectScope().run(() => useDockedToast(visible, panel))
    expect(useToast().toasts).toEqual([])

    visible.value = true
    await nextTick()
    expect(useToast().toasts).toEqual([
      expect.objectContaining({ kind: 'dock' })
    ])

    visible.value = false
    await nextTick()
    expect(useToast().toasts).toEqual([])
  })

  it('removes the panel when its owner is disposed', () => {
    const scope = effectScope()
    scope.run(() => useDockedToast(() => true, panel))
    expect(useToast().toasts).toHaveLength(1)

    scope.stop()

    expect(useToast().toasts).toEqual([])
  })
})
