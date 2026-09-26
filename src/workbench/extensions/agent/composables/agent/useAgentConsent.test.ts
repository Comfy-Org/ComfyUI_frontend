import { useDialogService } from '@/services/dialogService'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
vi.mock(import('firebase/auth'))
import type { GlobalSetting } from '@comfyorg/ingest-types'
import { useAuthStore } from '@/stores/authStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, reactive, ref } from 'vue'
import { setImmediate } from 'node:timers/promises'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useDialogStore } from '@/stores/dialogStore'
import { i18n } from '@/i18n'
import { api } from '@/scripts/api'

import { useAgentConsent } from './useAgentConsent'

vi.mock(import('@/composables/auth/useCurrentUser'))

vi.mock(import('@/config/comfyApi'), () => ({
  getComfyApiBaseUrl: () => 'https://api.comfy.test'
}))

vi.mock(import('@/platform/distribution/types'), () => ({
  isCloud: false
}))

vi.mock(import('@/scripts/api'))

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

const telemetry = vi.hoisted(() => ({
  trackAgentConsentShown: vi.fn(),
  trackAgentConsentResolved: vi.fn(),
  trackAgentConsentOfferExited: vi.fn()
}))
vi.mock<unknown>(import('@/platform/telemetry'), () => ({
  useTelemetry: () => telemetry
}))

async function renderConsentCard(dialog: {
  component: unknown
  contentProps: Record<string, unknown>
}) {
  render(
    defineComponent({
      setup: () => () =>
        h(dialog.component as Parameters<typeof h>[0], dialog.contentProps)
    }),
    { global: { plugins: [i18n] } }
  )
  await screen.findByRole('heading', {
    name: i18n.global.t('agent.consent.title')
  })
}

function clickCardAction(action: 'accept' | 'reject') {
  return userEvent.click(
    screen.getByRole('button', {
      name: i18n.global.t(`agent.consent.${action}`)
    })
  )
}

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
    vi.mocked(api.fetchApi).mockReset()
    fetchWithUnifiedRemint.mockReset()
    fetchWithUnifiedRemint.mockResolvedValue(settingResponse(false))
    reportError.mockReset()
    vi.mocked(useToastStore().add).mockReset()
  })

  it.for(['first_load', 'button_click'] as const)(
    'reports the card as shown with trigger %s when it mounts',
    async (trigger) => {
      const request = useAgentConsent().withConsent(trigger, vi.fn())
      const dialog = await waitForConsentDialog()

      expect(telemetry.trackAgentConsentShown).not.toHaveBeenCalled()
      await renderConsentCard(dialog)
      expect(telemetry.trackAgentConsentShown.mock.calls).toEqual([
        [{ trigger }]
      ])

      await clickCardAction('reject')
      await request
    }
  )

  it('reports a rejection as the resolved decision', async () => {
    const onOpen = vi.fn()
    const request = useAgentConsent().withConsent('button_click', onOpen)
    const dialog = await waitForConsentDialog()
    await renderConsentCard(dialog)

    await clickCardAction('reject')
    await request

    expect(telemetry.trackAgentConsentResolved.mock.calls).toEqual([
      [{ decision: 'rejected', save_error_shown: false }]
    ])
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('reports an acceptance as the resolved decision once the save lands', async () => {
    fetchWithUnifiedRemint
      .mockResolvedValueOnce(settingResponse(false))
      .mockResolvedValueOnce(savedResponse())
    const onOpen = vi.fn()
    const request = useAgentConsent().withConsent('button_click', onOpen)
    const dialog = await waitForConsentDialog()
    await renderConsentCard(dialog)

    await clickCardAction('accept')
    await request

    expect(telemetry.trackAgentConsentResolved.mock.calls).toEqual([
      [{ decision: 'accepted', save_error_shown: false }]
    ])
    expect(onOpen).toHaveBeenCalledOnce()
  })

  it('reports no outcome while a failed save leaves the card open', async () => {
    fetchWithUnifiedRemint
      .mockResolvedValueOnce(settingResponse(false))
      .mockRejectedValueOnce(new Error('offline'))
    void useAgentConsent().withConsent('button_click', vi.fn())
    const dialog = await waitForConsentDialog()

    ;(dialog.contentProps.onAccept as () => void)()
    await vi.waitFor(() => {
      expect(dialog.contentProps.error).toBe(
        i18n.global.t('agent.consent.saveError')
      )
    })

    // A raised save is not an ending: the card is still on screen and
    // retryable, so the outcome belongs to whatever the user does next.
    expect(telemetry.trackAgentConsentResolved).not.toHaveBeenCalled()
  })

  it('reports a dismissal as its own outcome, not as an unresolved card', async () => {
    const request = useAgentConsent().withConsent('button_click', vi.fn())
    const dialog = await waitForConsentDialog()
    await renderConsentCard(dialog)
    ;(dialog.dialogComponentProps.onClose as () => void)()
    await request

    expect(telemetry.trackAgentConsentShown).toHaveBeenCalledOnce()
    expect(telemetry.trackAgentConsentResolved.mock.calls).toEqual([
      [{ decision: 'dismissed', save_error_shown: false }]
    ])
    expect(telemetry.trackAgentConsentOfferExited).not.toHaveBeenCalled()
  })

  it('separates giving up after a failed save from walking away', async () => {
    fetchWithUnifiedRemint
      .mockResolvedValueOnce(settingResponse(false))
      .mockRejectedValueOnce(new Error('offline'))
    const request = useAgentConsent().withConsent('button_click', vi.fn())
    const dialog = await waitForConsentDialog()
    await renderConsentCard(dialog)

    await clickCardAction('accept')
    await vi.waitFor(() => {
      expect(dialog.contentProps.error).toBe(
        i18n.global.t('agent.consent.saveError')
      )
    })
    ;(dialog.dialogComponentProps.onClose as () => void)()
    await request

    expect(telemetry.trackAgentConsentResolved.mock.calls).toEqual([
      [{ decision: 'dismissed', save_error_shown: true }]
    ])
  })

  it('reports an acceptance that did not persist without raising', async () => {
    const identity = ref('account-a')
    useCurrentUser().resolvedUserInfo = computed(() => ({ id: identity.value }))
    const onOpen = vi.fn()
    const request = useAgentConsent().withConsent('button_click', onOpen)
    const dialog = await waitForConsentDialog()
    await renderConsentCard(dialog)

    // The scope moves under the open card, so `accept` resolves false: nothing
    // was stored, nothing raised, and no error is shown. The user believes they
    // consented.
    identity.value = 'account-b'
    await clickCardAction('accept')
    await request

    expect(telemetry.trackAgentConsentResolved.mock.calls).toEqual([
      [{ decision: 'accept_not_persisted', save_error_shown: false }]
    ])
    expect(reportError).not.toHaveBeenCalled()
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('reports a card closed before it rendered as an exit, not a dismissal', async () => {
    const request = useAgentConsent().withConsent('first_load', vi.fn())
    const dialog = await waitForConsentDialog()

    // No `renderConsentCard`: the async card chunk has not mounted, so there is
    // no impression for an outcome to resolve.
    ;(dialog.dialogComponentProps.onClose as () => void)()
    await request

    expect(telemetry.trackAgentConsentShown).not.toHaveBeenCalled()
    expect(telemetry.trackAgentConsentResolved).not.toHaveBeenCalled()
    expect(telemetry.trackAgentConsentOfferExited.mock.calls).toEqual([
      [
        {
          exit: 'card_closed_before_mount',
          stage: 'request',
          retry_armed: false,
          trigger: 'first_load'
        }
      ]
    ])
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

    const request = useAgentConsent().withConsent('button_click', onOpen)

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

    const request = useAgentConsent().withConsent('button_click', onOpen)
    await vi.waitFor(() => {
      expect(fetchWithUnifiedRemint).toHaveBeenCalledOnce()
    })
    await request

    expect(useDialogStore().dialogStack).toHaveLength(0)
    expect(onOpen).not.toHaveBeenCalled()
    expect(reportError).toHaveBeenCalledOnce()
    expect(useToastStore().add).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: i18n.global.t('agent.consent.loadError')
      })
    )
    // `reportError` has no product-analytics sink, so before this the funnel saw
    // a first-run user who was simply never offered.
    expect(telemetry.trackAgentConsentOfferExited.mock.calls).toEqual([
      [
        {
          exit: 'consent_read_failed',
          stage: 'request',
          retry_armed: false,
          trigger: 'button_click'
        }
      ]
    ])
  })

  it('separates a failed scope probe from a failed consent read', async () => {
    // Signed in, but the account has not resolved to a user id, so `ensureScope`
    // raises before any read is attempted. The message it raises is the one
    // `load` also raises when its auth header is missing, which is why the
    // reason comes from which call was in flight rather than from the error.
    useCurrentUser().resolvedUserInfo = computed(() => null)
    const onOpen = vi.fn()

    const request = useAgentConsent().withConsent('button_click', onOpen)
    await request

    expect(fetchWithUnifiedRemint).not.toHaveBeenCalled()
    expect(useDialogStore().dialogStack).toHaveLength(0)
    expect(onOpen).not.toHaveBeenCalled()
    expect(telemetry.trackAgentConsentOfferExited.mock.calls).toEqual([
      [
        {
          exit: 'scope_probe_failed',
          stage: 'request',
          retry_armed: false,
          trigger: 'button_click'
        }
      ]
    ])
  })

  it('names the scope moving while it was still being resolved', async () => {
    Object.assign(useTeamWorkspaceStore(), { activeWorkspaceId: null })
    vi.mocked(useTeamWorkspaceStore().initialize).mockImplementationOnce(
      async () => {
        Object.assign(useTeamWorkspaceStore(), {
          activeWorkspaceId: 'workspace-b',
          workspaceTransitionGeneration:
            useTeamWorkspaceStore().workspaceTransitionGeneration + 1
        })
      }
    )
    const onOpen = vi.fn()

    const request = useAgentConsent().withConsent('first_load', onOpen)
    await request

    expect(fetchWithUnifiedRemint).not.toHaveBeenCalled()
    expect(onOpen).not.toHaveBeenCalled()
    expect(reportError).not.toHaveBeenCalled()
    expect(telemetry.trackAgentConsentOfferExited.mock.calls).toEqual([
      [
        {
          exit: 'scope_changed_before_read',
          stage: 'request',
          retry_armed: false,
          trigger: 'first_load'
        }
      ]
    ])
  })

  it('names the scope moving while the consent read was in flight', async () => {
    const load = deferred<Response>()
    fetchWithUnifiedRemint.mockReturnValueOnce(load.promise)
    const onOpen = vi.fn()

    const request = useAgentConsent().withConsent('first_load', onOpen)
    await vi.waitFor(() => {
      expect(fetchWithUnifiedRemint).toHaveBeenCalledOnce()
    })
    Object.assign(useTeamWorkspaceStore(), {
      activeWorkspaceId: 'workspace-b',
      workspaceTransitionGeneration:
        useTeamWorkspaceStore().workspaceTransitionGeneration + 1
    })
    load.resolve(settingResponse(false))
    await request

    expect(useDialogStore().dialogStack).toHaveLength(0)
    expect(onOpen).not.toHaveBeenCalled()
    expect(reportError).not.toHaveBeenCalled()
    expect(telemetry.trackAgentConsentOfferExited.mock.calls).toEqual([
      [
        {
          exit: 'scope_changed_after_read',
          stage: 'request',
          retry_armed: false,
          trigger: 'first_load'
        }
      ]
    ])
  })

  it('reports a repeated attempt each time rather than once per page load', async () => {
    fetchWithUnifiedRemint.mockRejectedValue(new Error('offline'))

    await useAgentConsent().withConsent('button_click', vi.fn())
    await useAgentConsent().withConsent('button_click', vi.fn())

    // Not deduplicated, deliberately: the `request` stage is only reachable once
    // per consent scope per page load automatically, and once per click from the
    // button, so a repeat is a repeated attempt rather than a measure of how
    // long the tab was open.
    expect(telemetry.trackAgentConsentOfferExited).toHaveBeenCalledTimes(2)
  })

  it('configures the first-use card as an accessible dismissable dialog', async () => {
    const request = useAgentConsent().withConsent('button_click', vi.fn())

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
    const request = useAgentConsent().withConsent('button_click', onOpen)
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
    const request = useAgentConsent().withConsent('button_click', onOpen, {
      onShown
    })
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
      const request = useAgentConsent().withConsent('button_click', onOpen, {
        onShown: () => {
          localStorage.setItem(key, 'true')
        }
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

  it('asks canShow only after the setting has loaded and keeps the card off when it says no', async () => {
    const load = deferred<Response>()
    fetchWithUnifiedRemint.mockReturnValueOnce(load.promise)
    const onOpen = vi.fn()
    const onShown = vi.fn()
    const canShow = vi.fn(() => false)
    const request = useAgentConsent().withConsent('button_click', onOpen, {
      onShown,
      canShow
    })

    await setImmediate()
    expect(canShow).not.toHaveBeenCalled()

    load.resolve(settingResponse(false))
    await request

    expect(canShow).toHaveBeenCalledOnce()
    expect(useDialogStore().dialogStack).toHaveLength(0)
    expect(onShown).not.toHaveBeenCalled()
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('keeps the card retryable and the panel closed when saving fails', async () => {
    fetchWithUnifiedRemint
      .mockResolvedValueOnce(settingResponse(false))
      .mockRejectedValueOnce(new Error('offline'))
    const onOpen = vi.fn()
    void useAgentConsent().withConsent('button_click', onOpen)
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
    const request = useAgentConsent().withConsent('button_click', onOpen)
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
    const request = useAgentConsent().withConsent('button_click', onOpen)
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

    const request = useAgentConsent().withConsent('button_click', onOpen)
    const dialog = await waitForConsentDialog()
    ;(dialog.contentProps.onAccept as () => void)()
    await request

    expect(useDialogService().showSignInDialog).toHaveBeenCalledOnce()
    expect(useTeamWorkspaceStore().initialize).toHaveBeenCalledOnce()
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
    // Two outcomes for one card, and that is the contract: the card's own
    // ending is `accepted_pending_sign_in`, and `accepted` is the later moment
    // consent actually became stored.
    expect(telemetry.trackAgentConsentResolved.mock.calls).toEqual([
      [{ decision: 'accepted_pending_sign_in', save_error_shown: false }],
      [{ decision: 'accepted', save_error_shown: false }]
    ])
  })

  it('writes nothing when a signed-out Local user cancels sign-in', async () => {
    useCurrentUser().isLoggedIn = computed(() => false)
    useCurrentUser().resolvedUserInfo = computed(() => null)
    vi.mocked(useDialogService().showSignInDialog).mockResolvedValueOnce(false)
    const onOpen = vi.fn()

    const request = useAgentConsent().withConsent('button_click', onOpen)
    const dialog = await waitForConsentDialog()
    ;(dialog.contentProps.onAccept as () => void)()
    await request

    expect(fetchWithUnifiedRemint).not.toHaveBeenCalled()
    expect(onOpen).not.toHaveBeenCalled()
    expect(reportError).not.toHaveBeenCalled()
    expect(useToastStore().add).not.toHaveBeenCalled()
    // Accepting the card is only half of the signed-out flow. Consent was
    // never persisted, so reporting it accepted would put a decision the user
    // did not complete into the funnel — but the card half did happen, and
    // `accepted_pending_sign_in` with no later `accepted` is exactly how an
    // abandoned sign-in is now readable.
    expect(telemetry.trackAgentConsentResolved.mock.calls).toEqual([
      [{ decision: 'accepted_pending_sign_in', save_error_shown: false }]
    ])
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

    const request = useAgentConsent().withConsent('button_click', onOpen)
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
    const retry = useAgentConsent().withConsent('button_click', onOpen)
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
    const first = useAgentConsent().withConsent('button_click', oldOpen)
    await startConsent()
    await vi.waitFor(() =>
      expect(fetchWithUnifiedRemint).toHaveBeenCalledTimes(2)
    )

    useDialogStore().closeDialog({ key: 'agent-consent' })
    await first
    const newOpen = vi.fn()
    const second = useAgentConsent().withConsent('button_click', newOpen)
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

    const request = useAgentConsent().withConsent('button_click', onOpen)
    await vi.waitFor(() => {
      expect(fetchWithUnifiedRemint).toHaveBeenCalledOnce()
    })
    await request

    expect(onOpen).toHaveBeenCalledOnce()
    expect(useDialogStore().dialogStack).toHaveLength(0)
  })

  it('asks again after Skip without recording a decline', async () => {
    const firstRequest = useAgentConsent().withConsent('button_click', vi.fn())
    const firstDialog = await waitForConsentDialog()

    ;(firstDialog.contentProps.onReject as () => void)()
    await Promise.resolve(firstRequest)

    expect(useDialogStore().dialogStack).toHaveLength(0)

    const secondRequest = useAgentConsent().withConsent('button_click', vi.fn())
    const secondDialog = await waitForConsentDialog()
    expect(secondDialog.key).toBe('agent-consent')
    ;(secondDialog.contentProps.onReject as () => void)()
    await Promise.resolve(secondRequest)
  })
  it('does not apply an open consent card to another workspace', async () => {
    const onOpen = vi.fn()
    const request = useAgentConsent().withConsent('button_click', onOpen)
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
