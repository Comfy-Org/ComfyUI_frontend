import type { GlobalSetting } from '@comfyorg/ingest-types'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useDialogStore } from '@/stores/dialogStore'

import { useAgentConsent } from './useAgentConsent'

const authState = vi.hoisted(() => ({
  loggedIn: false,
  identity: 'account-a' as string | null,
  workspaceId: 'workspace-a' as string | null,
  generation: 0
}))
vi.mock<unknown>(import('@/composables/auth/useCurrentUser'), () => ({
  useCurrentUser: () => ({
    get isLoggedIn() {
      return { value: authState.loggedIn }
    },
    resolvedUserInfo: {
      get value() {
        return authState.identity ? { id: authState.identity } : null
      }
    }
  })
}))

const accountAuthState = vi.hoisted(() => ({
  getUserAuthHeader: vi.fn(),
  initialize: vi.fn()
}))
vi.mock<unknown>(import('@/stores/authStore'), () => ({
  useAuthStore: () => ({
    getUserAuthHeader: accountAuthState.getUserAuthHeader,
    getWorkspaceAuthHeader: accountAuthState.getUserAuthHeader
  })
}))

vi.mock<unknown>(
  import('@/platform/workspace/stores/teamWorkspaceStore'),
  () => ({
    useTeamWorkspaceStore: () => ({
      get activeWorkspaceId() {
        return authState.workspaceId
      },
      get workspaceTransitionGeneration() {
        return authState.generation
      },
      isSwitching: false,
      initialize: accountAuthState.initialize
    })
  })
)

vi.mock<unknown>(import('@/config/comfyApi'), () => ({
  getComfyApiBaseUrl: () => 'https://api.comfy.test'
}))

vi.mock<unknown>(import('@/platform/distribution/types'), () => ({
  isCloud: false
}))

const fetchApi = vi.hoisted(() => vi.fn())
vi.mock<unknown>(import('@/scripts/api'), () => ({ api: { fetchApi } }))

const fetchWithUnifiedRemint = vi.hoisted(() => vi.fn())
vi.mock<unknown>(import('@/platform/auth/unified/remintRetry'), () => ({
  fetchWithUnifiedRemint,
  shouldRemintCloudRequest: () => Promise.resolve(false)
}))

const showSignInDialog = vi.hoisted(() => vi.fn<() => Promise<boolean>>())
vi.mock<unknown>(import('@/services/dialogService'), () => ({
  useDialogService: () => ({ showSignInDialog })
}))

const reportError = vi.hoisted(() => vi.fn())
vi.mock<unknown>(import('@/platform/telemetry/reportError'), () => ({
  reportError
}))

const addToast = vi.hoisted(() => vi.fn())
vi.mock<unknown>(import('@/platform/updates/common/toastStore'), () => ({
  useToastStore: () => ({ add: addToast })
}))

async function waitForConsentDialog() {
  const dialogStore = useDialogStore()
  await vi.waitFor(() => {
    expect(dialogStore.dialogStack).toHaveLength(1)
  })
  return dialogStore.dialogStack[0]
}

const stored: GlobalSetting = {
  key: 'Comfy.AgentPanel.ConsentAccepted',
  value: true,
  updated_at: '2026-09-09T00:00:00Z'
}
const settingResponse = (accepted: boolean) =>
  new Response(
    JSON.stringify(
      accepted
        ? stored
        : {
            code: 'NOT_FOUND',
            message: 'Setting is not set for this user and workspace'
          }
    ),
    { status: accepted ? 200 : 404 }
  )
const savedResponse = () => settingResponse(true)

describe('useAgentConsent', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    authState.loggedIn = true
    authState.identity = 'account-a'
    authState.workspaceId = 'workspace-a'
    authState.generation = 0
    accountAuthState.initialize.mockResolvedValue(undefined)
    accountAuthState.getUserAuthHeader.mockReset()
    accountAuthState.getUserAuthHeader.mockResolvedValue({
      Authorization: 'Bearer account-a-token'
    })
    fetchApi.mockReset()
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
        'https://api.comfy.test/api/global-settings',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer account-a-token'
          }),
          body: JSON.stringify({ key: stored.key, value: true })
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

    authState.identity = 'account-b'
    ;(dialog.contentProps.onAccept as () => void)()
    await request

    expect(fetchWithUnifiedRemint).toHaveBeenCalledOnce()
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('authenticates signed-out Local users before saving to their account', async () => {
    authState.loggedIn = false
    authState.identity = null
    authState.workspaceId = null
    accountAuthState.initialize.mockImplementationOnce(async () => {
      authState.workspaceId = 'workspace-a'
    })
    showSignInDialog.mockImplementationOnce(async () => {
      authState.loggedIn = true
      authState.identity = 'account-a'
      return true
    })
    fetchWithUnifiedRemint.mockResolvedValueOnce(savedResponse())
    const onOpen = vi.fn()

    const request = useAgentConsent().withConsent(onOpen)
    const dialog = await waitForConsentDialog()
    ;(dialog.contentProps.onAccept as () => void)()
    await request

    expect(showSignInDialog).toHaveBeenCalledOnce()
    expect(accountAuthState.initialize).toHaveBeenCalledOnce()
    expect(fetchWithUnifiedRemint).toHaveBeenCalledOnce()
    expect(fetchWithUnifiedRemint).toHaveBeenCalledWith(
      'https://api.comfy.test/api/global-settings',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ key: stored.key, value: true })
      }),
      false
    )
    expect(onOpen).toHaveBeenCalledOnce()
  })

  it('writes nothing when a signed-out Local user cancels sign-in', async () => {
    authState.loggedIn = false
    authState.identity = null
    showSignInDialog.mockResolvedValueOnce(false)
    const onOpen = vi.fn()

    const request = useAgentConsent().withConsent(onOpen)
    const dialog = await waitForConsentDialog()
    ;(dialog.contentProps.onAccept as () => void)()
    await request

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

    expect(useDialogStore().dialogStack).toHaveLength(0)

    const secondRequest = useAgentConsent().withConsent(vi.fn())
    const secondDialog = await waitForConsentDialog()
    expect(secondDialog.key).toBe('agent-consent')
    ;(secondDialog.contentProps.onReject as () => void)()
    await Promise.resolve(secondRequest)
  })
  it('does not apply an open consent card to another workspace', async () => {
    const onOpen = vi.fn()
    const request = useAgentConsent().withConsent(onOpen)
    const dialog = await waitForConsentDialog()
    authState.workspaceId = 'workspace-b'
    authState.generation += 1
    fetchWithUnifiedRemint.mockResolvedValueOnce(savedResponse())
    ;(dialog.contentProps.onAccept as () => void)()
    await request
    expect(fetchWithUnifiedRemint).toHaveBeenCalledOnce()
    expect(onOpen).not.toHaveBeenCalled()
  })
})
