/**
 * prompt() and confirm() share the 'global-prompt' key while
 * dialogStore.showDialog only raises an existing dialog with the same key, so
 * concurrent calls are serialized FIFO to guarantee every returned promise
 * settles. These tests use the real dialogStore because the bug lives in the
 * service/store interaction.
 *
 * The FIFO tail lives at module level in dialogService, so each test resets
 * the module registry and dynamically imports the modules it needs — a
 * mid-test failure then cannot wedge the queue for later tests.
 */
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/i18n', () => ({
  t: (key: string) => key
}))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => ({ trackEvent: vi.fn() })
}))

vi.mock('@/platform/distribution/types', () => ({
  isCloud: false
}))

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    isActiveSubscription: { value: true },
    isFreeTier: { value: false },
    type: { value: 'legacy' }
  })
}))

/**
 * Macrotask flush: releasing the FIFO queue takes several promise hops inside
 * enqueueGlobalPrompt, and a macrotask runs only after all pending microtasks.
 * `nextTick()` awaits a fixed number of hops and would couple these tests to
 * that internal chain depth.
 */
function flushQueue() {
  return new Promise((resolve) => setTimeout(resolve))
}

async function importDialogModules() {
  const [{ useDialogService }, { useDialogStore }] = await Promise.all([
    import('@/services/dialogService'),
    import('@/stores/dialogStore')
  ])
  return { service: useDialogService(), dialogStore: useDialogStore() }
}

describe('dialogService global prompt FIFO queue', () => {
  beforeEach(() => {
    vi.resetModules()
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('settles both promises when two confirm() calls race', async () => {
    const { service, dialogStore } = await importDialogModules()

    const first = service.confirm({ title: 'First', message: 'first?' })
    const second = service.confirm({ title: 'Second', message: 'second?' })

    await flushQueue()

    expect(
      dialogStore.dialogStack.filter((d) => d.key === 'global-prompt')
    ).toHaveLength(1)
    expect(dialogStore.dialogStack[0].title).toBe('First')

    const onConfirm = dialogStore.dialogStack[0].contentProps.onConfirm as (
      value?: boolean
    ) => void
    onConfirm(true)
    dialogStore.closeDialog()
    await expect(first).resolves.toBe(true)

    await flushQueue()

    expect(dialogStore.dialogStack).toHaveLength(1)
    expect(dialogStore.dialogStack[0].title).toBe('Second')
    expect(dialogStore.dialogStack[0].contentProps.message).toBe('second?')

    dialogStore.closeDialog()
    await expect(second).resolves.toBeNull()
  })

  it('keeps FIFO order when prompt() is queued behind confirm()', async () => {
    const { service, dialogStore } = await importDialogModules()
    const { default: ConfirmationDialogContent } =
      await import('@/components/dialog/content/ConfirmationDialogContent.vue')
    const { default: PromptDialogContent } =
      await import('@/components/dialog/content/PromptDialogContent.vue')

    const confirmResult = service.confirm({
      title: 'Confirm',
      message: 'sure?'
    })
    const promptResult = service.prompt({
      title: 'Prompt',
      message: 'name?',
      defaultValue: 'initial'
    })

    await flushQueue()

    expect(dialogStore.dialogStack[0].component).toBe(ConfirmationDialogContent)

    dialogStore.closeDialog()
    await expect(confirmResult).resolves.toBeNull()

    await flushQueue()

    expect(dialogStore.dialogStack).toHaveLength(1)
    const promptDialog = dialogStore.dialogStack[0]
    expect(promptDialog.component).toBe(PromptDialogContent)
    expect(promptDialog.title).toBe('Prompt')
    expect(promptDialog.contentProps.defaultValue).toBe('initial')

    const onConfirm = promptDialog.contentProps.onConfirm as (
      value: string
    ) => void
    onConfirm('typed value')
    dialogStore.closeDialog()
    await expect(promptResult).resolves.toBe('typed value')
  })

  it('closeDialog without a key settles the active promise as null and releases the queue', async () => {
    const { service, dialogStore } = await importDialogModules()

    const first = service.confirm({ title: 'Escaped', message: 'close me' })
    const second = service.confirm({ title: 'Following', message: 'next up' })

    await flushQueue()

    dialogStore.closeDialog()
    await expect(first).resolves.toBeNull()

    await flushQueue()

    expect(dialogStore.dialogStack[0].title).toBe('Following')

    dialogStore.closeDialog()
    await expect(second).resolves.toBeNull()
  })

  it('settles a cap-evicted prompt as null and releases the queue', async () => {
    const { service, dialogStore } = await importDialogModules()
    const filler = { render: () => null }

    // 9 fillers first so the global-prompt lands at dialogStack[0] — equal
    // priorities insert at the front, and the 10-cap evicts from index 0.
    for (let i = 0; i < 9; i++) {
      dialogStore.showDialog({ key: `filler-${i}`, component: filler })
    }

    const first = service.confirm({ title: 'Evicted', message: 'gone?' })
    const second = service.confirm({ title: 'Following', message: 'next up' })

    await flushQueue()

    expect(dialogStore.dialogStack).toHaveLength(10)
    expect(dialogStore.dialogStack[0].key).toBe('global-prompt')

    // Overflow the cap: the prompt at index 0 is evicted without any user
    // interaction. Its promise must settle (null) instead of hanging, and
    // the FIFO queue must release so the second confirm can show.
    dialogStore.showDialog({ key: 'overflow', component: filler })

    await expect(first).resolves.toBeNull()

    await flushQueue()

    const promptDialog = dialogStore.dialogStack.find(
      (d) => d.key === 'global-prompt'
    )
    expect(promptDialog?.title).toBe('Following')

    dialogStore.closeDialog({ key: 'global-prompt' })
    await expect(second).resolves.toBeNull()
  })
})
