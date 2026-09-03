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

const accountAuthState = vi.hoisted(() => ({
  identity: 'account-a' as string | null,
  getUserAuthHeader: vi.fn()
}))
vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    currentUserIdentity: () => accountAuthState.identity,
    getUserAuthHeader: accountAuthState.getUserAuthHeader
  })
}))

vi.mock('@/config/comfyApi', () => ({
  getComfyApiBaseUrl: () => 'https://api.comfy.test'
}))

const fetchWithUnifiedRemint = vi.hoisted(() => vi.fn())
vi.mock('@/platform/auth/unified/remintRetry', () => ({
  fetchWithUnifiedRemint,
  shouldRemintCloudRequest: () => Promise.resolve(false)
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

async function waitForConsentDialog() {
  const dialogStore = useDialogStore()
  await vi.waitFor(() => {
    expect(dialogStore.dialogStack).toHaveLength(1)
  })
  return dialogStore.dialogStack[0]
}

const settingResponse = (value: boolean) =>
  new Response(JSON.stringify({ value }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })

const savedResponse = () =>
  new Response(JSON.stringify({ value: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })

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
    accountAuthState.identity = 'account-a'
    accountAuthState.getUserAuthHeader.mockReset()
    accountAuthState.getUserAuthHeader.mockResolvedValue({
      Authorization: 'Bearer account-a-token'
    })
    fetchWithUnifiedRemint.mockReset()
    fetchWithUnifiedRemint.mockResolvedValue(settingResponse(false))
    showSignInDialog.mockReset()
    reportError.mockReset()
    addToast.mockReset()
  })

  it('waits for the account setting to load before deciding whether to ask', async () => {
    let finishLoad = (_response: Response): void => {}
    fetchWithUnifiedRemint.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          finishLoad = resolve
        })
    )
    const onOpen = vi.fn()

    const request = useAgentConsent().withConsent(onOpen)

    expect(useDialogStore().dialogStack).toHaveLength(0)
    expect(onOpen).not.toHaveBeenCalled()

    await vi.waitFor(() => {
      expect(fetchWithUnifiedRemint).toHaveBeenCalledOnce()
    })
    finishLoad(settingResponse(false))
    const dialog = await waitForConsentDialog()
    ;(dialog.contentProps.onReject as () => void)()
    await Promise.resolve(request)
  })

  it('reports an account-setting load failure without opening the card or panel', async () => {
    fetchWithUnifiedRemint.mockRejectedValueOnce(new Error('offline'))
    const onOpen = vi.fn()

    const request = useAgentConsent().withConsent(onOpen)
    await vi.waitFor(() => {
      expect(fetchWithUnifiedRemint).toHaveBeenCalledOnce()
    })
    await request

    expect(useDialogStore().dialogStack).toHaveLength(0)
    expect(onOpen).not.toHaveBeenCalled()
    expect(reportError).toHaveBeenCalledOnce()
    expect(addToast).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: 'Could not load your Agent preference. Try again.'
      })
    )
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
    let finishSave = (_response: Response): void => {}
    fetchWithUnifiedRemint
      .mockResolvedValueOnce(settingResponse(false))
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            finishSave = resolve
          })
      )
    const onOpen = vi.fn()
    const request = useAgentConsent().withConsent(onOpen)
    const dialog = await waitForConsentDialog()

    ;(dialog.contentProps.onAccept as () => void)()

    await vi.waitFor(() => {
      expect(fetchWithUnifiedRemint).toHaveBeenLastCalledWith(
        'https://api.comfy.test/api/settings/Comfy.AgentPanel.ConsentAccepted',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer account-a-token'
          }),
          body: 'true'
        }),
        false
      )
    })
    expect(dialog.contentProps.accepting).toBe(true)
    expect(onOpen).not.toHaveBeenCalled()

    finishSave(savedResponse())
    await Promise.resolve(request)

    expect(onOpen).toHaveBeenCalledOnce()
    expect(useDialogStore().dialogStack).toHaveLength(0)
  })

  it('keeps the card retryable and the panel closed when saving fails', async () => {
    fetchWithUnifiedRemint
      .mockResolvedValueOnce(settingResponse(false))
      .mockRejectedValueOnce(new Error('offline'))
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

  it('does not apply an open consent card to a different account', async () => {
    const onOpen = vi.fn()
    const request = useAgentConsent().withConsent(onOpen)
    const dialog = await waitForConsentDialog()

    accountAuthState.identity = 'account-b'
    ;(dialog.contentProps.onAccept as () => void)()
    await request

    expect(fetchWithUnifiedRemint).toHaveBeenCalledOnce()
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('authenticates signed-out Local users before saving to their account', async () => {
    authState.loggedIn = false
    accountAuthState.identity = null
    showSignInDialog.mockImplementationOnce(async () => {
      authState.loggedIn = true
      accountAuthState.identity = 'account-a'
      return true
    })
    fetchWithUnifiedRemint.mockResolvedValueOnce(savedResponse())
    const onOpen = vi.fn()

    const request = useAgentConsent().withConsent(onOpen)
    const dialog = await waitForConsentDialog()
    ;(dialog.contentProps.onAccept as () => void)()
    await request

    expect(showSignInDialog).toHaveBeenCalledOnce()
    expect(settingState.set).not.toHaveBeenCalled()
    expect(fetchWithUnifiedRemint).toHaveBeenCalledOnce()
    expect(fetchWithUnifiedRemint).toHaveBeenCalledWith(
      'https://api.comfy.test/api/settings/Comfy.AgentPanel.ConsentAccepted',
      expect.objectContaining({ method: 'POST', body: 'true' }),
      false
    )
    expect(onOpen).toHaveBeenCalledOnce()
  })

  it('writes nothing when a signed-out Local user cancels sign-in', async () => {
    authState.loggedIn = false
    accountAuthState.identity = null
    showSignInDialog.mockResolvedValueOnce(false)
    const onOpen = vi.fn()

    const request = useAgentConsent().withConsent(onOpen)
    const dialog = await waitForConsentDialog()
    ;(dialog.contentProps.onAccept as () => void)()
    await request

    expect(settingState.set).not.toHaveBeenCalled()
    expect(fetchWithUnifiedRemint).not.toHaveBeenCalled()
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('opens without a card when the account setting is already accepted', async () => {
    fetchWithUnifiedRemint.mockResolvedValueOnce(settingResponse(true))
    const onOpen = vi.fn()

    const request = useAgentConsent().withConsent(onOpen)
    await vi.waitFor(() => {
      expect(fetchWithUnifiedRemint).toHaveBeenCalledOnce()
    })
    await request

    expect(onOpen).toHaveBeenCalledOnce()
    expect(useDialogStore().dialogStack).toHaveLength(0)
  })

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
