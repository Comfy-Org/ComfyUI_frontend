import { describe, expect, it, vi } from 'vitest'

import { showUnsavedWorkDialog } from '@/platform/workspace/showUnsavedWorkDialog'
import { useDialogStore } from '@/stores/dialogStore'

vi.mock(import('@/i18n'))
vi.mock(import('@comfyorg/telemetry'))
vi.mock(import('@/platform/distribution/types'), () => ({ isCloud: false }))
vi.mock(import('@/platform/billing/composables/useBillingContext'))

function flushQueue() {
  return new Promise((resolve) => setTimeout(resolve))
}

function prompt(title: string) {
  return {
    title,
    message: `${title}?`,
    itemList: ['workflows/portrait.json'],
    denyLabel: 'Switch without saving',
    confirmLabel: 'Save and switch'
  }
}

describe('showUnsavedWorkDialog', () => {
  it('answers with the button picked and closes the dialog', async () => {
    const dialogStore = useDialogStore()

    const answer = showUnsavedWorkDialog(prompt('Portrait'))
    await flushQueue()
    const onResult = dialogStore.dialogStack[0].contentProps.onResult as (
      result: boolean | null
    ) => void
    onResult(true)

    await expect(answer).resolves.toBe(true)
    expect(dialogStore.dialogStack).toHaveLength(0)
  })

  it('settles both asks when a second comes while the first is open', async () => {
    const dialogStore = useDialogStore()

    const first = showUnsavedWorkDialog(prompt('Portrait'))
    const second = showUnsavedWorkDialog(prompt('Video'))
    await flushQueue()

    expect(dialogStore.dialogStack).toHaveLength(1)
    expect(dialogStore.dialogStack[0].contentProps.title).toBe('Portrait')

    dialogStore.closeDialog({ key: dialogStore.dialogStack[0].key })
    await expect(first).resolves.toBeNull()
    await flushQueue()

    expect(dialogStore.dialogStack).toHaveLength(1)
    expect(dialogStore.dialogStack[0].contentProps.title).toBe('Video')

    const onResult = dialogStore.dialogStack[0].contentProps.onResult as (
      result: boolean | null
    ) => void
    onResult(false)
    await expect(second).resolves.toBe(false)
  })
})
