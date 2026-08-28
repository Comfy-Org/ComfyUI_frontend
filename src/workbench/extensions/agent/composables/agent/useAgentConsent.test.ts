import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useDialogStore } from '@/stores/dialogStore'

import { useAgentConsent } from './useAgentConsent'

const settingState = vi.hoisted(() => ({
  accepted: false,
  error: undefined as unknown,
  load: vi.fn<() => Promise<void>>(async () => {}),
  set: vi.fn<(id: string, value: boolean) => Promise<void>>(
    async (_id, value) => {
      settingState.accepted = value
    }
  )
}))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    get: () => settingState.accepted,
    get error() {
      return settingState.error
    },
    load: settingState.load,
    set: settingState.set
  })
}))

const authState = vi.hoisted(() => ({ loggedIn: false }))
vi.mock('@/composables/auth/useCurrentUser', () => ({
  useCurrentUser: () => ({
    get isLoggedIn() {
      return { value: authState.loggedIn }
    },
    resolvedUserInfo: { value: null }
  })
}))

const distribution = vi.hoisted(() => ({ isCloud: true }))
vi.mock('@/platform/distribution/types', () => ({
  get isCloud() {
    return distribution.isCloud
  }
}))

const showSignInDialog = vi.hoisted(() => vi.fn<() => Promise<boolean>>())
vi.mock('@/services/dialogService', () => ({
  useDialogService: () => ({ showSignInDialog })
}))

const reportError = vi.hoisted(() => vi.fn())
vi.mock('@/platform/telemetry/reportError', () => ({ reportError }))

const addToast = vi.hoisted(() => vi.fn())
vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: () => ({ add: addToast })
}))

function resetPrototypeConsent(): void {
  const consent = useAgentConsent() as ReturnType<typeof useAgentConsent> & {
    accepted?: { value: boolean }
  }
  if (consent.accepted) consent.accepted.value = false
}

async function waitForConsentDialog() {
  const dialogStore = useDialogStore()
  await vi.waitFor(() => {
    expect(dialogStore.dialogStack).toHaveLength(1)
  })
  return dialogStore.dialogStack[0]
}

describe('useAgentConsent', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    settingState.accepted = false
    settingState.error = undefined
    settingState.load.mockReset()
    settingState.load.mockResolvedValue()
    settingState.set.mockReset()
    settingState.set.mockImplementation(async (_id, value) => {
      settingState.accepted = value
    })
    authState.loggedIn = true
    distribution.isCloud = true
    showSignInDialog.mockReset()
    reportError.mockReset()
    addToast.mockReset()
    resetPrototypeConsent()
  })

  it('waits for settings to load before deciding whether to ask', async () => {
    let finishLoad = (): void => {}
    settingState.load.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishLoad = resolve
        })
    )
    const onOpen = vi.fn()

    const request = useAgentConsent().withConsent(onOpen)

    expect(useDialogStore().dialogStack).toHaveLength(0)
    expect(onOpen).not.toHaveBeenCalled()

    finishLoad()
    const dialog = await waitForConsentDialog()
    ;(dialog.contentProps.onReject as () => void)()
    await Promise.resolve(request)
  })

  it('configures the first-use card as an accessible dismissable dialog', async () => {
    const request = useAgentConsent().withConsent(vi.fn())

    const dialog = await waitForConsentDialog()

    expect(dialog.contentProps.titleId).toBe('agent-consent')
    expect(dialog.dialogComponentProps.dismissableMask).toBe(true)
    expect(dialog.dialogComponentProps.closeOnEscape).toBe(true)

    ;(dialog.contentProps.onReject as () => void)()
    await Promise.resolve(request)
  })

  it('keeps the panel closed until acceptance is durably saved', async () => {
    let finishSave = (): void => {}
    settingState.set.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishSave = () => {
            settingState.accepted = true
            resolve()
          }
        })
    )
    const onOpen = vi.fn()
    const request = useAgentConsent().withConsent(onOpen)
    const dialog = await waitForConsentDialog()

    ;(dialog.contentProps.onAccept as () => void)()

    await vi.waitFor(() => {
      expect(settingState.set).toHaveBeenCalledWith(
        'Comfy.AgentPanel.ConsentAccepted',
        true
      )
    })
    expect(dialog.contentProps.accepting).toBe(true)
    expect(onOpen).not.toHaveBeenCalled()

    finishSave()
    await Promise.resolve(request)

    expect(onOpen).toHaveBeenCalledOnce()
    expect(useDialogStore().dialogStack).toHaveLength(0)
  })

  it('keeps the card retryable and the panel closed when saving fails', async () => {
    settingState.set.mockRejectedValueOnce(new Error('offline'))
    const onOpen = vi.fn()
    void useAgentConsent().withConsent(onOpen)
    const dialog = await waitForConsentDialog()

    ;(dialog.contentProps.onAccept as () => void)()

    await vi.waitFor(() => {
      expect(dialog.contentProps.error).toBe(
        'Could not save your preference. Try again.'
      )
    })
    expect(dialog.contentProps.accepting).toBe(false)
    expect(onOpen).not.toHaveBeenCalled()
    expect(reportError).toHaveBeenCalledOnce()
  })

  it.for([
    { signedIn: true, opens: 1 },
    { signedIn: false, opens: 0 }
  ])(
    'continues accepted Local activation only when sign-in resolves $signedIn',
    async ({ signedIn, opens }) => {
      settingState.accepted = true
      authState.loggedIn = false
      distribution.isCloud = false
      showSignInDialog.mockResolvedValueOnce(signedIn)
      const onOpen = vi.fn()

      await Promise.resolve(useAgentConsent().withConsent(onOpen))

      expect(showSignInDialog).toHaveBeenCalledOnce()
      expect(onOpen).toHaveBeenCalledTimes(opens)
      expect(useDialogStore().dialogStack).toHaveLength(0)
    }
  )

  it('asks again after Skip without recording a decline', async () => {
    const firstRequest = useAgentConsent().withConsent(vi.fn())
    const firstDialog = await waitForConsentDialog()

    ;(firstDialog.contentProps.onReject as () => void)()
    await Promise.resolve(firstRequest)

    expect(settingState.set).not.toHaveBeenCalled()
    expect(useDialogStore().dialogStack).toHaveLength(0)

    const secondRequest = useAgentConsent().withConsent(vi.fn())
    const secondDialog = await waitForConsentDialog()
    expect(secondDialog.key).toBe('agent-consent')
    ;(secondDialog.contentProps.onReject as () => void)()
    await Promise.resolve(secondRequest)
  })
})
