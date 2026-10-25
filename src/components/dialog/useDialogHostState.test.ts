import { describe, expect, it } from 'vitest'
import { defineComponent } from 'vue'

import { useDialogStore } from '@/stores/dialogStore'

import { useDialogHostState } from './useDialogHostState'

describe('useDialogHostState', () => {
  it('tracks whether the managed dialog host has an open dialog', () => {
    const dialogStore = useDialogStore()
    const { hasOpenDialog } = useDialogHostState()

    expect(hasOpenDialog.value).toBe(false)

    const dialog = dialogStore.showDialog({
      component: defineComponent({})
    })
    expect(hasOpenDialog.value).toBe(true)

    dialogStore.closeDialog({ key: dialog.key })
    expect(hasOpenDialog.value).toBe(false)
  })
})
