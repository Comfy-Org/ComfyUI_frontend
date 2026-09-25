import { assert, describe, expect, it, onTestFinished, vi } from 'vitest'

import ConfirmationDialogContent from '@/components/dialog/content/ConfirmationDialogContent.vue'
import PromptDialogContent from '@/components/dialog/content/PromptDialogContent.vue'
import { useDialogService } from '@/services/dialogService'
import { useDialogStore } from '@/stores/dialogStore'

vi.mock(import('@/i18n'), () => ({
  t: (key: string) => key
}))

vi.mock(import('@/platform/telemetry'))
vi.mock(import('@/composables/billing/useBillingContext'))
vi.mock(import('@/platform/distribution/types'), () => ({ isCloud: false }))

function createDialogTest() {
  const service = useDialogService()
  const dialogStore = useDialogStore()
  const pending: Promise<unknown>[] = []

  function track<T>(result: Promise<T>): Promise<T> {
    pending.push(result.catch(() => undefined))
    return result
  }

  onTestFinished(async () => {
    const unsubscribe = dialogStore.$onAction(({ name, after }) => {
      if (name === 'showDialog') {
        after((dialog) => dialogStore.closeDialog({ key: dialog.key }))
      }
    })
    try {
      dialogStore.dialogStack
        .slice()
        .forEach(({ key }) => dialogStore.closeDialog({ key }))
      await Promise.all(pending)
    } finally {
      unsubscribe()
    }
  })

  return { service, dialogStore, track }
}

describe('dialogService prompt queues', () => {
  it.for([
    { name: 'shared', key: undefined },
    { name: 'custom', key: 'global-desktop-login-confirm' }
  ])(
    'settles concurrent confirmations in order for a $name key',
    async ({ key }) => {
      const { service, dialogStore, track } = createDialogTest()
      const first = track(
        service.confirm({ key, title: 'First', message: 'first?' })
      )
      const second = track(
        service.confirm({ key, title: 'Second', message: 'second?' })
      )

      await vi.waitFor(() => {
        expect(dialogStore.dialogStack).toHaveLength(1)
        expect(dialogStore.dialogStack[0].title).toBe('First')
      })

      const onConfirm = dialogStore.dialogStack[0].contentProps.onConfirm
      assert(typeof onConfirm === 'function')
      onConfirm(true)
      dialogStore.closeDialog()
      await expect(first).resolves.toBe(true)

      await vi.waitFor(() => {
        expect(dialogStore.dialogStack).toHaveLength(1)
        expect(dialogStore.dialogStack[0].title).toBe('Second')
      })
      expect(dialogStore.dialogStack[0].contentProps.message).toBe('second?')

      dialogStore.closeDialog()
      await expect(second).resolves.toBeNull()
    }
  )

  it('keeps FIFO order when prompt() is queued behind confirm()', async () => {
    const { service, dialogStore, track } = createDialogTest()
    const confirmResult = track(
      service.confirm({ title: 'Confirm', message: 'sure?' })
    )
    const promptResult = track(
      service.prompt({
        title: 'Prompt',
        message: 'name?',
        defaultValue: 'initial'
      })
    )

    await vi.waitFor(() =>
      expect(dialogStore.dialogStack[0]?.component).toBe(
        ConfirmationDialogContent
      )
    )
    dialogStore.closeDialog()
    await expect(confirmResult).resolves.toBeNull()

    await vi.waitFor(() =>
      expect(dialogStore.dialogStack[0]?.component).toBe(PromptDialogContent)
    )
    expect(dialogStore.dialogStack).toHaveLength(1)
    const promptDialog = dialogStore.dialogStack[0]
    expect(promptDialog.title).toBe('Prompt')
    expect(promptDialog.contentProps.defaultValue).toBe('initial')

    const onConfirm = promptDialog.contentProps.onConfirm
    assert(typeof onConfirm === 'function')
    onConfirm('typed value')
    dialogStore.closeDialog()
    await expect(promptResult).resolves.toBe('typed value')
  })

  it('opens and settles a distinct key while the shared prompt stays open', async () => {
    const { service, dialogStore, track } = createDialogTest()
    const shared = track(service.prompt({ title: 'Shared', message: 'name?' }))
    await vi.waitFor(() =>
      expect(dialogStore.isDialogOpen('global-prompt')).toBe(true)
    )

    const ownKey = track(
      service.confirm({
        key: 'global-desktop-login-confirm',
        title: 'Independent',
        message: 'continue?'
      })
    )
    await vi.waitFor(() => expect(dialogStore.dialogStack).toHaveLength(2))
    dialogStore.closeDialog({ key: 'global-desktop-login-confirm' })
    await expect(ownKey).resolves.toBeNull()
    expect(dialogStore.isDialogOpen('global-prompt')).toBe(true)

    dialogStore.closeDialog({ key: 'global-prompt' })
    await expect(shared).resolves.toBeNull()
  })

  it('releases the queue when opening the first dialog throws', async () => {
    const { service, dialogStore, track } = createDialogTest()
    vi.mocked(dialogStore.showDialog).mockImplementationOnce(() => {
      throw new Error('boom')
    })
    const first = track(service.prompt({ title: 'First', message: 'name?' }))
    const second = track(
      service.confirm({ title: 'Second', message: 'continue?' })
    )

    await expect(first).rejects.toThrow('boom')
    await vi.waitFor(() =>
      expect(dialogStore.dialogStack[0]?.title).toBe('Second')
    )
    dialogStore.closeDialog()
    await expect(second).resolves.toBeNull()
  })

  it('settles an evicted prompt and opens the next queued confirmation', async () => {
    const { service, dialogStore, track } = createDialogTest()
    const filler = { render: () => null }
    Array.from({ length: 9 }, (_, i) =>
      dialogStore.showDialog({ key: `filler-${i}`, component: filler })
    )
    const first = track(
      service.confirm({ title: 'Evicted', message: 'close me' })
    )
    const second = track(
      service.confirm({ title: 'Following', message: 'next up' })
    )

    await vi.waitFor(() =>
      expect(dialogStore.dialogStack[0]?.key).toBe('global-prompt')
    )
    expect(dialogStore.dialogStack).toHaveLength(10)
    dialogStore.showDialog({ key: 'overflow', component: filler })
    await expect(first).resolves.toBeNull()

    await vi.waitFor(() =>
      expect(
        dialogStore.dialogStack.find((d) => d.key === 'global-prompt')?.title
      ).toBe('Following')
    )
    dialogStore.closeDialog({ key: 'global-prompt' })
    await expect(second).resolves.toBeNull()
  })
})
