import { useDialogService } from '@/services/dialogService'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
vi.mock(import('firebase/auth'))
vi.mock(import('vuefire'), () => ({ useFirebaseAuth: vi.fn() }))
import { computed, defineComponent, h, reactive, ref } from 'vue'
import type { GlobalSetting } from '@comfyorg/ingest-types'
import { useAuthStore } from '@/stores/authStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setImmediate } from 'node:timers/promises'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useDialogStore } from '@/stores/dialogStore'
import { i18n } from '@/i18n'

import { useAgentConsent } from './useAgentConsent'

vi.mock(import('@/composables/auth/useCurrentUser'))

vi.mock(import('@/config/comfyApi'), () => ({
  getComfyApiBaseUrl: () => 'https://api.comfy.test'
}))

vi.mock(import('@/platform/distribution/types'), () => ({
  isCloud: false
}))

const fetchApi = vi.hoisted(() => vi.fn())
vi.mock<unknown>(import('@/scripts/api'), () => ({ api: { fetchApi } }))

const fetchWithUnifiedRemint = vi.hoisted(() => vi.fn())
vi.mock(import('@/platform/auth/unified/remintRetry'), () => ({
  attachUnifiedRemintInterceptor: vi.fn(),
  fetchWithUnifiedRemint,
  shouldRemintCloudRequest: () => Promise.resolve(false)
}))

vi.mock(import('@/services/dialogService'))

const reportError = vi.hoisted(() => vi.fn())
vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError
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

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

async function startConsent() {
  const dialog = await waitForConsentDialog()
  const accept = dialog.contentProps.onAccept
  if (typeof accept !== 'function') throw new Error('Missing consent action')
  accept()
}

describe('useAgentConsent', () => {
  beforeEach(() => {
    useCurrentUser().isLoggedIn = computed(() => true)
    useCurrentUser().resolvedUserInfo = computed(() => ({ id: 'account-a' }))
    localStorage.clear()
    Object.assign(useTeamWorkspaceStore(), { activeWorkspaceId: 'workspace-a' })
    Object.assign(useTeamWorkspaceStore(), { workspaceTransitionGeneration: 0 })
    vi.mocked(useTeamWorkspaceStore().initialize).mockResolvedValue(undefined)
    vi.mocked(useAuthStore().getWorkspaceAuthHeader).mockReset()
    vi.mocked(useAuthStore().getWorkspaceAuthHeader).mockResolvedValue({
      Authorization: 'Bearer account-a-token'
    })
    fetchApi.mockReset()
    fetchWithUnifiedRemint.mockReset()
    fetchWithUnifiedRemint.mockResolvedValue(settingResponse(false))
    reportError.mockReset()
    vi.mocked(useToastStore().add).mockReset()
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
    expect(vi.mocked(useToastStore().add)).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: i18n.global.t('agent.consent.loadError')
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

  it('reports the card as shown only after its async component mounts', async () => {
    const onOpen = vi.fn()
    const onShown = vi.fn()
    const request = useAgentConsent().withConsent(onOpen, onShown)
    const dialog = await waitForConsentDialog()

    expect(onShown).not.toHaveBeenCalled()
    render(
      defineComponent({
        setup: () => () => h(dialog.component, dialog.contentProps)
      }),
      { global: { plugins: [i18n] } }
    )
    expect(
      await screen.findByRole('heading', {
        name: i18n.global.t('agent.consent.title')
      })
    ).toBeInTheDocument()
    expect(onShown).toHaveBeenCalledOnce()

    await userEvent.click(
      screen.getByRole('button', {
        name: i18n.global.t('agent.consent.reject')
      })
    )
    await request
    expect(onOpen).not.toHaveBeenCalled()
  })

  it.for([
    { scope: 'account', user: null, workspaceId: 'workspace-a' },
    {
      scope: 'workspace',
      user: { id: 'account-a' },
      workspaceId: 'workspace-b'
    }
  ])(
    'does not consume the automatic offer when the $scope changes before mount',
    async ({ user, workspaceId }) => {
      const currentUser = ref<{ id: string } | null>({ id: 'account-a' })
      vi.spyOn(
        useCurrentUser().resolvedUserInfo,
        'value',
        'get'
      ).mockImplementation(() => currentUser.value)
      const key = 'Comfy.AgentConsent.AutoShown.account-a.workspace-a'
      const onOpen = vi.fn()
      const request = useAgentConsent().withConsent(onOpen, () => {
        localStorage.setItem(key, 'true')
      })
      const dialog = await waitForConsentDialog()
      currentUser.value = user
      Object.assign(useTeamWorkspaceStore(), { activeWorkspaceId: workspaceId })

      render(
        defineComponent({
          setup: () => () => h(dialog.component, dialog.contentProps)
        }),
        { global: { plugins: [i18n] } }
      )
      expect(
        await screen.findByRole('heading', {
          name: i18n.global.t('agent.consent.title')
        })
      ).toBeInTheDocument()
      await userEvent.click(
        screen.getByRole('button', {
          name: i18n.global.t('agent.consent.reject')
        })
      )
      await request

      expect(localStorage.getItem(key)).toBeNull()
      expect(onOpen).not.toHaveBeenCalled()
    }
  )

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
        i18n.global.t('agent.consent.saveError')
      )
    })
    expect(dialog.contentProps.accepting).toBe(false)
    expect(onOpen).not.toHaveBeenCalled()
    expect(reportError).toHaveBeenCalledOnce()
  })

  it('keeps a missing-auth save retryable in the same account', async () => {
    const onOpen = vi.fn()
    const request = useAgentConsent().withConsent(onOpen)
    const dialog = await waitForConsentDialog()
    vi.mocked(useAuthStore().getWorkspaceAuthHeader).mockResolvedValueOnce(null)

    ;(dialog.contentProps.onAccept as () => void)()
    await vi.waitFor(() =>
      expect(dialog.contentProps.error).toBe(
        i18n.global.t('agent.consent.saveError')
      )
    )
    expect(useDialogStore().dialogStack).toHaveLength(1)
    expect(fetchWithUnifiedRemint).toHaveBeenCalledOnce()
    expect(onOpen).not.toHaveBeenCalled()

    fetchWithUnifiedRemint.mockResolvedValueOnce(savedResponse())
    ;(dialog.contentProps.onAccept as () => void)()
    await request
    expect(onOpen).toHaveBeenCalledOnce()
    expect(useDialogStore().dialogStack).toHaveLength(0)
  })

  it('does not apply an open consent card to a different account', async () => {
    const identity = ref('account-a')
    useCurrentUser().resolvedUserInfo = computed(() => ({ id: identity.value }))
    const onOpen = vi.fn()
    const request = useAgentConsent().withConsent(onOpen)
    const dialog = await waitForConsentDialog()

    identity.value = 'account-b'
    ;(dialog.contentProps.onAccept as () => void)()
    await request

    expect(fetchWithUnifiedRemint).toHaveBeenCalledOnce()
    expect(onOpen).not.toHaveBeenCalled()
    expect(useDialogStore().dialogStack).toHaveLength(0)
    expect(reportError).not.toHaveBeenCalled()
  })

  it('authenticates signed-out Local users before saving to their account', async () => {
    const authState = reactive<{ loggedIn: boolean; identity: string | null }>({
      loggedIn: false,
      identity: null
    })
    useCurrentUser().isLoggedIn = computed(() => authState.loggedIn)
    useCurrentUser().resolvedUserInfo = computed(() =>
      authState.identity ? { id: authState.identity } : null
    )
    Object.assign(useTeamWorkspaceStore(), { activeWorkspaceId: null })
    vi.mocked(useTeamWorkspaceStore().initialize).mockImplementationOnce(
      async () => {
        Object.assign(useTeamWorkspaceStore(), {
          activeWorkspaceId: 'workspace-a'
        })
      }
    )
    vi.mocked(useDialogService().showSignInDialog).mockImplementationOnce(
      async () => {
        authState.loggedIn = true
        authState.identity = 'account-a'
        return true
      }
    )
    fetchWithUnifiedRemint.mockResolvedValueOnce(savedResponse())
    const onOpen = vi.fn()

    const request = useAgentConsent().withConsent(onOpen)
    const dialog = await waitForConsentDialog()
    ;(dialog.contentProps.onAccept as () => void)()
    await request

    expect(useDialogService().showSignInDialog).toHaveBeenCalledOnce()
    expect(vi.mocked(useTeamWorkspaceStore().initialize)).toHaveBeenCalledOnce()
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
    useCurrentUser().isLoggedIn = computed(() => false)
    useCurrentUser().resolvedUserInfo = computed(() => null)
    vi.mocked(useDialogService().showSignInDialog).mockResolvedValueOnce(false)
    const onOpen = vi.fn()

    const request = useAgentConsent().withConsent(onOpen)
    const dialog = await waitForConsentDialog()
    ;(dialog.contentProps.onAccept as () => void)()
    await request

    expect(fetchWithUnifiedRemint).not.toHaveBeenCalled()
    expect(onOpen).not.toHaveBeenCalled()
    expect(reportError).not.toHaveBeenCalled()
    expect(useToastStore().add).not.toHaveBeenCalled()
  })

  it('reports sign-in loading failure without saving or opening and allows another attempt', async () => {
    const authState = reactive<{ loggedIn: boolean; identity: string | null }>({
      loggedIn: false,
      identity: null
    })
    useCurrentUser().isLoggedIn = computed(() => authState.loggedIn)
    useCurrentUser().resolvedUserInfo = computed(() =>
      authState.identity ? { id: authState.identity } : null
    )
    const error = new Error('Sign-in chunk could not load')
    vi.mocked(useDialogService().showSignInDialog).mockRejectedValueOnce(error)
    const onOpen = vi.fn()

    const request = useAgentConsent().withConsent(onOpen)
    const outcome = request.catch((error: unknown) => error)
    await startConsent()
    expect(await outcome).toBeUndefined()

    expect(fetchWithUnifiedRemint).not.toHaveBeenCalled()
    expect(onOpen).not.toHaveBeenCalled()
    expect(useDialogStore().dialogStack).toHaveLength(0)
    expect(reportError).toHaveBeenCalledWith(error, {
      errorType: 'agent_consent_sign_in_failure'
    })
    expect(useToastStore().add).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: i18n.global.t('agent.consent.signInError')
      })
    )

    vi.mocked(useDialogService().showSignInDialog).mockImplementationOnce(
      async () => {
        authState.loggedIn = true
        authState.identity = 'account-a'
        return true
      }
    )
    fetchWithUnifiedRemint.mockResolvedValueOnce(savedResponse())
    const retry = useAgentConsent().withConsent(onOpen)
    await startConsent()
    await retry
    expect(onOpen).toHaveBeenCalledOnce()
  })

  it('does not let a closed dialog save failure change a replacement dialog', async () => {
    const oldSave = deferred<Response>()
    const newSave = deferred<Response>()
    fetchWithUnifiedRemint
      .mockResolvedValueOnce(settingResponse(false))
      .mockReturnValueOnce(oldSave.promise)
      .mockReturnValueOnce(newSave.promise)
    const oldOpen = vi.fn()
    const first = useAgentConsent().withConsent(oldOpen)
    await startConsent()
    await vi.waitFor(() =>
      expect(fetchWithUnifiedRemint).toHaveBeenCalledTimes(2)
    )

    useDialogStore().closeDialog({ key: 'agent-consent' })
    await first
    const newOpen = vi.fn()
    const second = useAgentConsent().withConsent(newOpen)
    await startConsent()
    await vi.waitFor(() =>
      expect(fetchWithUnifiedRemint).toHaveBeenCalledTimes(3)
    )

    oldSave.reject(new Error('Old save failed'))
    await setImmediate()
    expect(useDialogStore().dialogStack[0].contentProps).toMatchObject({
      accepting: true,
      error: ''
    })
    expect(reportError).not.toHaveBeenCalled()

    newSave.resolve(savedResponse())
    await second
    expect(oldOpen).not.toHaveBeenCalled()
    expect(newOpen).toHaveBeenCalledOnce()
    expect(useDialogStore().dialogStack).toHaveLength(0)
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
    Object.assign(useTeamWorkspaceStore(), { activeWorkspaceId: 'workspace-b' })
    Object.assign(useTeamWorkspaceStore(), {
      workspaceTransitionGeneration:
        useTeamWorkspaceStore().workspaceTransitionGeneration + 1
    })
    fetchWithUnifiedRemint.mockResolvedValueOnce(savedResponse())
    ;(dialog.contentProps.onAccept as () => void)()
    await request
    expect(fetchWithUnifiedRemint).toHaveBeenCalledOnce()
    expect(onOpen).not.toHaveBeenCalled()
  })
})
