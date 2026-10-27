import { useAuthDialogs } from '@/composables/auth/useAuthDialogs'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
vi.mock(import('firebase/auth'))
import type { GlobalSetting } from '@comfyorg/ingest-types'
import { useAuthStore } from '@/stores/authStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useToast } from '@/components/ui/toast/toastStore'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Ref } from 'vue'
import { computed, defineComponent, h, reactive, ref } from 'vue'
import { setImmediate } from 'node:timers/promises'
import { getActivePinia } from 'pinia'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useDialogStore } from '@/stores/dialogStore'
import type { DialogInstance } from '@/stores/dialogStore'
import { i18n } from '@/i18n'
import { api } from '@/scripts/api'
import { useAgentConsentStore } from '@/workbench/extensions/agent/stores/agent/agentConsentStore'
import { useAgentConsentIntroductionStore } from '@/workbench/extensions/agent/stores/agent/agentConsentIntroductionStore'
import { useAgentComposerStore } from '@/workbench/extensions/agent/stores/agent/agentComposerStore'
import { writePendingSignInAccept } from '@/workbench/extensions/agent/services/agent/pendingSignInAccept'
import { createMockLoadedWorkflow } from '@/utils/__tests__/litegraphTestUtils'

import { useAgentConsent } from './useAgentConsent'

vi.mock(import('@/composables/auth/useCurrentUser'))

vi.mock(import('@/config/comfyApi'), () => ({
  getComfyApiBaseUrl: () => 'https://api.comfy.test'
}))

const distribution = vi.hoisted(() => ({ isCloud: false, isDesktop: true }))
vi.mock(import('@/platform/distribution/types'), () => ({
  get isCloud() {
    return distribution.isCloud
  },
  get isDesktop() {
    return distribution.isDesktop
  }
}))

vi.mock(import('@/scripts/api'))

const fetchWithUnifiedRemint = vi.hoisted(() => vi.fn())
vi.mock(import('@/platform/auth/unified/remintRetry'), () => ({
  attachUnifiedRemintInterceptor: vi.fn(),
  fetchWithUnifiedRemint,
  provideUnifiedRemint: vi.fn(),
  shouldRemintCloudRequest: () => Promise.resolve(false)
}))

vi.mock(import('@/composables/auth/useAuthDialogs'))

const reportError = vi.hoisted(() => vi.fn())
vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError
}))

const recordConsentOfferDeclined = vi.hoisted(() => vi.fn())
vi.mock(
  import('@/workbench/extensions/agent/services/agent/consentOfferDeclined'),
  () => ({
    recordConsentOfferDeclined
  })
)

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

function dismissConsent(dialog: DialogInstance) {
  const close = dialog.dialogComponentProps.onClose
  if (typeof close !== 'function') throw new Error('Missing close handler')
  close()
}

describe('useAgentConsent', () => {
  beforeEach(() => {
    distribution.isCloud = false
    distribution.isDesktop = true
    sessionStorage.clear()
    useCurrentUser().isLoggedIn = computed(() => true)
    useCurrentUser().resolvedUserInfo = computed(() => ({ id: 'account-a' }))
    localStorage.clear()
    Object.assign(useTeamWorkspaceStore(), { activeWorkspaceId: 'workspace-a' })
    Object.assign(useTeamWorkspaceStore(), { workspaceTransitionGeneration: 0 })
    vi.mocked(useTeamWorkspaceStore().initialize).mockResolvedValue(undefined)
    vi.mocked(useAuthStore().getUserAuthHeader).mockResolvedValue({
      Authorization: 'Bearer account-a-token'
    })
    vi.mocked(api.fetchApi).mockReset()
    fetchWithUnifiedRemint.mockReset()
    fetchWithUnifiedRemint.mockResolvedValue(settingResponse(false))
    reportError.mockReset()
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

  it.for([
    {
      action: 'Agree and continue',
      signedOut: true,
      key: 'Comfy.AgentConsent.IntroductionResponded.signed-out'
    },
    {
      action: 'Skip for now',
      signedOut: false,
      key: 'Comfy.AgentConsent.IntroductionResponded.account-a.workspace-a'
    }
  ])(
    'remembers the introduction response to $action for its scope',
    async ({ action, signedOut, key }) => {
      useCurrentUser().isLoggedIn = computed(() => !signedOut)
      useCurrentUser().resolvedUserInfo = computed(() =>
        signedOut ? null : { id: 'account-a' }
      )
      vi.mocked(useAuthDialogs().showSignInDialog).mockResolvedValueOnce(false)
      const onOpen = vi.fn()
      const request = useAgentConsent().withConsent('button_click', onOpen)
      const dialog = await waitForConsentDialog()
      await renderConsentCard(dialog)

      expect(localStorage.getItem(key)).toBeNull()
      await userEvent.click(screen.getByRole('button', { name: action }))
      await request

      await vi.waitFor(() => {
        expect(localStorage.getItem(key)).toBe('true')
      })
      expect(useAgentConsentStore().accepted).toBe(false)
      expect(onOpen).not.toHaveBeenCalled()
    }
  )

  it('does not remember a card that was dismissed without a decision', async () => {
    const request = useAgentConsent().withConsent('first_load', vi.fn())
    const dialog = await waitForConsentDialog()
    await renderConsentCard(dialog)

    useDialogStore().closeDialog({ key: 'agent-consent' })
    await request

    expect(
      localStorage.getItem(
        'Comfy.AgentConsent.IntroductionResponded.account-a.workspace-a'
      )
    ).toBeNull()
  })

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

  it('keeps a signed-in Local Skip local without writing Cloud refusal or consent', async () => {
    distribution.isCloud = false
    const request = useAgentConsent().withConsent('first_load', vi.fn())
    const dialog = await waitForConsentDialog()
    await renderConsentCard(dialog)

    await clickCardAction('reject')
    await request

    expect(recordConsentOfferDeclined).not.toHaveBeenCalled()
    expect(
      useAgentConsentIntroductionStore().hasResponded('account-a.workspace-a')
    ).toBe(true)
    expect(fetchWithUnifiedRemint).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ method: 'POST' }),
      expect.anything()
    )
  })

  describe('in Cloud', () => {
    beforeEach(() => {
      distribution.isCloud = true
      vi.mocked(api.apiURL).mockImplementation(
        (path) => `https://api.comfy.test/api${path}`
      )
      vi.mocked(useAuthStore().getWorkspaceAuthHeader).mockResolvedValue({
        Authorization: 'Bearer workspace-a-token'
      })
    })

    it('closes the card without waiting for the durable refusal, and writes no consent', async () => {
      const write = deferred<void>()
      recordConsentOfferDeclined.mockReturnValue(write.promise)
      const request = useAgentConsent().withConsent('button_click', vi.fn())
      const dialog = await waitForConsentDialog()
      await renderConsentCard(dialog)

      await clickCardAction('reject')
      await request

      expect(useDialogStore().dialogStack).toEqual([])
      expect(recordConsentOfferDeclined).toHaveBeenCalledOnce()
      expect(fetchWithUnifiedRemint).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ method: 'POST' }),
        expect.anything()
      )
      write.resolve()
    })

    it('does not attach a refusal to an account that did not own the card', async () => {
      const identity = ref('account-a')
      useCurrentUser().resolvedUserInfo = computed(() => ({
        id: identity.value
      }))
      const request = useAgentConsent().withConsent('button_click', vi.fn())
      const dialog = await waitForConsentDialog()
      await renderConsentCard(dialog)

      identity.value = 'account-b'
      await clickCardAction('reject')
      await request

      expect(recordConsentOfferDeclined).not.toHaveBeenCalled()
    })

    it('does not persist a refusal from the signed-out card', async () => {
      useCurrentUser().isLoggedIn = computed(() => false)
      useCurrentUser().resolvedUserInfo = computed(() => null)
      const request = useAgentConsent().withConsent('button_click', vi.fn())
      const dialog = await waitForConsentDialog()
      await renderConsentCard(dialog)

      await clickCardAction('reject')
      await request

      expect(recordConsentOfferDeclined).not.toHaveBeenCalled()
    })

    it('records no refusal when the card is dismissed instead of refused', async () => {
      const request = useAgentConsent().withConsent('button_click', vi.fn())
      const dialog = await waitForConsentDialog()
      await renderConsentCard(dialog)

      dismissConsent(dialog)
      await request

      expect(recordConsentOfferDeclined).not.toHaveBeenCalled()
    })
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

    await renderConsentCard(dialog)
    await clickCardAction('accept')
    await vi.waitFor(() => {
      expect(dialog.contentProps.error).toBe(
        i18n.global.t('agent.consent.saveError')
      )
    })

    expect(
      localStorage.getItem(
        'Comfy.AgentConsent.IntroductionResponded.account-a.workspace-a'
      )
    ).toBe('true')
    expect(useAgentConsentStore().accepted).toBe(false)
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
    expect(useToast().error).toHaveBeenCalledWith(
      i18n.global.t('g.error'),
      expect.objectContaining({
        description: i18n.global.t('agent.consent.loadError')
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

  it('configures the first-use card as a dismissable dialog', async () => {
    const request = useAgentConsent().withConsent('button_click', vi.fn())

    const dialog = await waitForConsentDialog()

    expect(dialog.dialogComponentProps.dismissOnPointerDownOutside).toBe(true)

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
    vi.mocked(useAuthStore().getUserAuthHeader).mockResolvedValueOnce(null)

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

  it.for([
    {
      scope: 'account',
      change: (userId: Ref<string>) => {
        userId.value = 'account-b'
      }
    },
    {
      scope: 'workspace',
      change: () => {
        Object.assign(useTeamWorkspaceStore(), {
          activeWorkspaceId: 'workspace-b'
        })
      }
    }
  ])(
    'closes a card when its $scope changes before a decision',
    async ({ change }) => {
      const userId = ref('account-a')
      useCurrentUser().resolvedUserInfo = computed(() => ({ id: userId.value }))
      const onSend = vi.fn()
      const request = useAgentConsent().withConsent('first_message', onSend)
      const dialog = await waitForConsentDialog()

      change(userId)
      await vi.waitFor(() =>
        expect(useDialogStore().dialogStack).toHaveLength(0)
      )
      const accept = dialog.contentProps.onAccept
      assert(typeof accept === 'function')
      accept()
      await request

      expect(fetchWithUnifiedRemint).toHaveBeenCalledOnce()
      expect(onSend).not.toHaveBeenCalled()
    }
  )

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
    vi.mocked(useAuthDialogs().showSignInDialog).mockImplementationOnce(
      async () => {
        expect(useAgentConsentIntroductionStore().isContinuingSignIn).toBe(true)
        authState.loggedIn = true
        authState.identity = 'account-a'
        return true
      }
    )
    fetchWithUnifiedRemint.mockResolvedValueOnce(savedResponse())
    const onOpen = vi.fn()

    const request = useAgentConsent().withConsent('button_click', onOpen)
    const dialog = await waitForConsentDialog()
    await renderConsentCard(dialog)
    expect(screen.getByText("You'll sign in next.")).toBeInTheDocument()
    expect(
      screen.getByText(
        /By clicking Agree and continue, you agree to its usage\./
      )
    ).toBeInTheDocument()
    expect(fetchWithUnifiedRemint).not.toHaveBeenCalled()
    expect(useAuthDialogs().showSignInDialog).not.toHaveBeenCalled()
    const continueButton = screen.getByRole('button', {
      name: 'Agree and continue'
    })
    expect(continueButton).toHaveAccessibleDescription("You'll sign in next.")
    await userEvent.click(continueButton)
    await request

    expect(useAuthDialogs().showSignInDialog).toHaveBeenCalledOnce()
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
    expect(useAgentConsentIntroductionStore().isContinuingSignIn).toBe(false)
    expect(telemetry.trackAgentConsentResolved.mock.calls).toEqual([
      [{ decision: 'accepted_pending_sign_in', save_error_shown: false }],
      [{ decision: 'accepted', save_error_shown: false }]
    ])
  })

  it('asks for consent again after a user cancels sign-in', async () => {
    useCurrentUser().isLoggedIn = computed(() => false)
    useCurrentUser().resolvedUserInfo = computed(() => null)
    vi.mocked(useAuthDialogs().showSignInDialog).mockResolvedValueOnce(false)
    const onOpen = vi.fn()

    const request = useAgentConsent().withConsent('button_click', onOpen)
    const dialog = await waitForConsentDialog()
    await renderConsentCard(dialog)
    await userEvent.click(
      screen.getByRole('button', { name: 'Agree and continue' })
    )
    await request

    expect(fetchWithUnifiedRemint).not.toHaveBeenCalled()
    expect(onOpen).not.toHaveBeenCalled()
    expect(reportError).not.toHaveBeenCalled()
    expect(useToast().toasts).toEqual([])
    expect(telemetry.trackAgentConsentResolved.mock.calls).toEqual([
      [{ decision: 'accepted_pending_sign_in', save_error_shown: false }]
    ])
    expect(
      localStorage.getItem(
        'Comfy.AgentConsent.IntroductionResponded.signed-out'
      )
    ).toBe('true')
    expect(useAgentConsentStore().accepted).toBe(false)

    const retry = useAgentConsent().withConsent('button_click', onOpen)
    const nextDialog = await waitForConsentDialog()
    expect(nextDialog.contentProps.requiresSignIn).toBe(true)
    expect(useAuthDialogs().showSignInDialog).toHaveBeenCalledOnce()
    const reject = nextDialog.contentProps.onReject
    assert(typeof reject === 'function')
    reject()
    await retry
    expect(onOpen).not.toHaveBeenCalled()
  })

  it.for([
    {
      scenario: 'Cloud record expiry',
      cloud: true,
      desktop: false,
      interruptRecovery: () =>
        vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 11 * 60 * 1000)
    },
    {
      scenario: 'Desktop record expiry',
      cloud: false,
      desktop: true,
      interruptRecovery: () =>
        vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 11 * 60 * 1000)
    },
    {
      scenario: 'Cloud storage read failure',
      cloud: true,
      desktop: false,
      interruptRecovery: () =>
        vi.spyOn(sessionStorage, 'getItem').mockImplementation(() => {
          throw new DOMException('Storage blocked', 'SecurityError')
        })
    },
    {
      scenario: 'Cloud scope-binding write failure',
      cloud: true,
      desktop: false,
      interruptRecovery: () =>
        vi.spyOn(sessionStorage, 'setItem').mockImplementation(() => {
          throw new DOMException('Storage full', 'QuotaExceededError')
        })
    }
  ])(
    'completes in-memory sign-in after $scenario',
    async ({ cloud, desktop, interruptRecovery }) => {
      distribution.isCloud = cloud
      distribution.isDesktop = desktop
      const user = ref<{ id: string } | null>(null)
      useCurrentUser().isLoggedIn = computed(() => user.value !== null)
      useCurrentUser().resolvedUserInfo = computed(() => user.value)
      vi.mocked(useAuthStore().getWorkspaceAuthHeader).mockResolvedValue({
        Authorization: 'Bearer account-a-token'
      })
      fetchWithUnifiedRemint.mockResolvedValueOnce(savedResponse())
      const signIn = deferred<boolean>()
      vi.mocked(useAuthDialogs().showSignInDialog).mockReturnValueOnce(
        signIn.promise
      )
      const onSend = vi.fn()
      const request = useAgentConsent().withConsent('first_message', onSend)
      await startConsent()
      await vi.waitFor(() =>
        expect(useAuthDialogs().showSignInDialog).toHaveBeenCalledOnce()
      )

      interruptRecovery()
      user.value = { id: 'account-a' }
      signIn.resolve(true)
      await request

      expect(useAgentConsentStore().accepted).toBe(true)
      expect(onSend).toHaveBeenCalledOnce()
      expect(fetchWithUnifiedRemint).toHaveBeenCalledOnce()
    }
  )

  it('reports when signed-out acceptance cannot resolve a persistence scope', async () => {
    useCurrentUser().isLoggedIn = computed(() => false)
    useCurrentUser().resolvedUserInfo = computed(() => null)
    vi.mocked(useAuthDialogs().showSignInDialog).mockResolvedValueOnce(true)
    vi.spyOn(useAgentConsentStore(), 'ensureScope').mockResolvedValueOnce(null)
    const onOpen = vi.fn()

    const request = useAgentConsent().withConsent('button_click', onOpen)
    const dialog = await waitForConsentDialog()
    ;(dialog.contentProps.onAccept as () => void)()
    await request

    expect(onOpen).not.toHaveBeenCalled()
    expect(telemetry.trackAgentConsentResolved.mock.calls).toEqual([
      [{ decision: 'accepted_pending_sign_in', save_error_shown: false }],
      [{ decision: 'accept_not_persisted', save_error_shown: false }]
    ])
  })

  it('reports when signed-out acceptance resolves but does not persist', async () => {
    const user = ref<{ id: string } | null>(null)
    useCurrentUser().isLoggedIn = computed(() => user.value !== null)
    useCurrentUser().resolvedUserInfo = computed(() => user.value)
    vi.mocked(useAuthDialogs().showSignInDialog).mockImplementationOnce(
      async () => {
        user.value = { id: 'account-a' }
        return true
      }
    )
    vi.spyOn(useAgentConsentStore(), 'ensureScope').mockResolvedValueOnce(
      'account-a/workspace-a'
    )
    vi.spyOn(useAgentConsentStore(), 'accept').mockResolvedValueOnce(false)
    const onOpen = vi.fn()

    const request = useAgentConsent().withConsent('button_click', onOpen)
    const dialog = await waitForConsentDialog()
    ;(dialog.contentProps.onAccept as () => void)()
    await request

    expect(onOpen).not.toHaveBeenCalled()
    expect(telemetry.trackAgentConsentResolved.mock.calls).toEqual([
      [{ decision: 'accepted_pending_sign_in', save_error_shown: false }],
      [{ decision: 'accept_not_persisted', save_error_shown: false }]
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
    vi.mocked(useAuthDialogs().showSignInDialog).mockRejectedValueOnce(error)
    const onOpen = vi.fn()

    const request = useAgentConsent().withConsent('button_click', onOpen)
    const outcome = request.catch((error: unknown) => error)
    await startConsent()
    expect(await outcome).toBeUndefined()

    expect(fetchWithUnifiedRemint).not.toHaveBeenCalled()
    expect(onOpen).not.toHaveBeenCalled()
    expect(useDialogStore().dialogStack).toHaveLength(0)
    expect(reportError).toHaveBeenCalledWith(error, {
      surface: 'agent',
      errorType: 'agent_consent_sign_in_failure'
    })
    expect(useToast().error).toHaveBeenCalledWith(
      i18n.global.t('g.error'),
      expect.objectContaining({
        description: i18n.global.t('agent.consent.signInError')
      })
    )

    vi.mocked(useAuthDialogs().showSignInDialog).mockImplementationOnce(
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

describe('accepting while signed out across a page reload', () => {
  const PENDING_KEY = 'Comfy.AgentPanel.PendingSignInAccept'

  function signedOut() {
    useCurrentUser().isLoggedIn = computed(() => false)
    useCurrentUser().resolvedUserInfo = computed(() => null)
  }

  function signedIn() {
    useCurrentUser().isLoggedIn = computed(() => true)
    useCurrentUser().resolvedUserInfo = computed(() => ({ id: 'account-a' }))
  }

  function holdDraft(text: string) {
    useAgentComposerStore().startSubmission({
      prompt: { text, references: [] },
      attachments: [],
      nodes: [],
      target: createMockLoadedWorkflow({ path: 'workflows/test.json' })
    })
  }

  function storePending(draft: string, savedAt = Date.now()) {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify({ draft, savedAt }))
  }

  beforeEach(() => {
    distribution.isCloud = false
    distribution.isDesktop = true
    vi.mocked(useAuthStore().getUserAuthHeader).mockResolvedValue({
      Authorization: 'Bearer account-a-token'
    })
    fetchWithUnifiedRemint.mockImplementation(async () => savedResponse())
    sessionStorage.clear()
    localStorage.clear()
    Object.assign(useTeamWorkspaceStore(), { activeWorkspaceId: 'workspace-a' })
    vi.mocked(useTeamWorkspaceStore().initialize).mockResolvedValue(undefined)
    vi.mocked(useAuthDialogs().showSignInDialog).mockReset()
    telemetry.trackAgentConsentResolved.mockReset()
    reportError.mockReset()
  })

  it('keeps the accept and held draft while the sign-in dialog is open', async () => {
    signedOut()
    holdDraft('make it blue')
    vi.mocked(useAuthDialogs().showSignInDialog).mockReturnValueOnce(
      new Promise(() => {})
    )

    void useAgentConsent().withConsent('first_message', vi.fn())
    await startConsent()
    await vi.waitFor(() =>
      expect(useAuthDialogs().showSignInDialog).toHaveBeenCalledOnce()
    )

    expect(JSON.parse(sessionStorage.getItem(PENDING_KEY)!)).toEqual({
      id: expect.any(String),
      draft: 'make it blue',
      savedAt: expect.any(Number)
    })
  })

  it.for([
    {
      answer: 'reject',
      action: (dialog: DialogInstance) =>
        (dialog.contentProps.onReject as () => void)()
    },
    { answer: 'dismiss', action: dismissConsent }
  ])(
    'keeps nothing when the signed-out card is answered with $answer',
    async ({ action }) => {
      signedOut()
      holdDraft('make it blue')

      const request = useAgentConsent().withConsent('first_message', vi.fn())
      const dialog = await waitForConsentDialog()
      action(dialog)
      await request

      expect(useAuthDialogs().showSignInDialog).not.toHaveBeenCalled()
      expect(sessionStorage.getItem(PENDING_KEY)).toBeNull()
    }
  )

  it.for([
    { outcome: 'cancelled', result: () => Promise.resolve(false) },
    {
      outcome: 'failed',
      result: () => Promise.reject(new Error('Sign-in chunk could not load'))
    },
    { outcome: 'completed', result: () => Promise.resolve(true) }
  ])(
    'clears the kept accept when sign-in is $outcome in the page',
    async ({ result }) => {
      signedOut()
      vi.mocked(useAuthDialogs().showSignInDialog).mockImplementationOnce(
        result
      )
      vi.spyOn(useAgentConsentStore(), 'ensureScope').mockResolvedValueOnce(
        'account-a/workspace-a'
      )
      vi.spyOn(useAgentConsentStore(), 'accept').mockResolvedValueOnce(true)

      const request = useAgentConsent().withConsent('first_message', vi.fn())
      await startConsent()
      await request

      expect(sessionStorage.getItem(PENDING_KEY)).toBeNull()
    }
  )

  it('saves consent and restores the draft after the reload, without sending', async () => {
    storePending('make it blue')
    signedIn()
    fetchWithUnifiedRemint.mockResolvedValueOnce(settingResponse(false))

    await useAgentConsent().resumeAcceptAfterReload()

    expect(useAgentConsentStore().accepted).toBe(true)
    expect(telemetry.trackAgentConsentResolved.mock.calls).toEqual([
      [{ decision: 'accepted', save_error_shown: false }]
    ])
    expect(useAgentComposerStore().draft).toBe('make it blue')
    expect(useAgentComposerStore().submission).toBeNull()
    expect(sessionStorage.getItem(PENDING_KEY)).toBeNull()
    expect(useAgentConsentIntroductionStore().isContinuingSignIn).toBe(false)
  })

  it('does not overwrite text already in the composer', async () => {
    storePending('make it blue')
    signedIn()
    useAgentComposerStore().setText('something newer')

    await useAgentConsent().resumeAcceptAfterReload()

    expect(useAgentComposerStore().draft).toBe('something newer')
  })

  it('accepts only once when resumed twice', async () => {
    storePending('make it blue')
    signedIn()
    fetchWithUnifiedRemint.mockResolvedValueOnce(settingResponse(false))
    const consent = useAgentConsent()
    await Promise.all([
      consent.resumeAcceptAfterReload(),
      consent.resumeAcceptAfterReload()
    ])

    expect(
      fetchWithUnifiedRemint.mock.calls.filter(
        ([, init]) => init.method === 'POST'
      )
    ).toHaveLength(1)
  })

  it.for([
    {
      case: 'expired',
      setup: () => storePending('old', Date.now() - 11 * 60 * 1000),
      authSetup: signedIn
    },
    { case: 'absent', setup: () => {}, authSetup: signedIn },
    {
      case: 'malformed',
      setup: () => sessionStorage.setItem(PENDING_KEY, '{"draft":1}'),
      authSetup: signedIn
    },
    {
      case: 'there but the user is signed out',
      setup: () => storePending('hi'),
      authSetup: signedOut
    }
  ])(
    'does nothing when the kept accept is $case',
    async ({ setup, authSetup }) => {
      setup()
      authSetup()
      const accept = vi.spyOn(useAgentConsentStore(), 'accept')

      await useAgentConsent().resumeAcceptAfterReload()

      expect(accept).not.toHaveBeenCalled()
      expect(telemetry.trackAgentConsentResolved).not.toHaveBeenCalled()
      expect(useAgentComposerStore().draft).toBe('')
      expect(sessionStorage.getItem(PENDING_KEY)).toBeNull()
    }
  )

  it('reports a failed save after the reload and keeps recovery for another attempt', async () => {
    storePending('make it blue')
    signedIn()
    fetchWithUnifiedRemint.mockResolvedValueOnce(settingResponse(false))
    const error = new Error('save failed')
    fetchWithUnifiedRemint.mockRejectedValueOnce(error)

    await useAgentConsent().resumeAcceptAfterReload()

    expect(reportError).toHaveBeenCalledWith(error, {
      surface: 'agent',
      errorType: 'agent_consent_setting_write_failure'
    })
    expect(useAgentComposerStore().draft).toBe('make it blue')
    expect(sessionStorage.getItem(PENDING_KEY)).not.toBeNull()
    await useAgentConsent().resumeAcceptAfterReload()
    expect(useAgentConsentStore().accepted).toBe(true)
    expect(sessionStorage.getItem(PENDING_KEY)).toBeNull()
  })

  it('keeps the accept while workspace readiness defers the real save', async () => {
    storePending('make it blue')
    signedIn()
    Object.assign(useTeamWorkspaceStore(), { isSwitching: true })
    fetchWithUnifiedRemint.mockResolvedValueOnce(settingResponse(false))

    await useAgentConsent().resumeAcceptAfterReload()

    expect(sessionStorage.getItem(PENDING_KEY)).not.toBeNull()
    expect(fetchWithUnifiedRemint).not.toHaveBeenCalled()
    Object.assign(useTeamWorkspaceStore(), { isSwitching: false })
    await useAgentConsent().resumeAcceptAfterReload()

    expect(useAgentConsentStore().accepted).toBe(true)
    expect(useAgentComposerStore().draft).toBe('make it blue')
    expect(sessionStorage.getItem(PENDING_KEY)).toBeNull()
  })

  it('keeps recovery through a save and deduplicates overlapping consumers', async () => {
    storePending('make it blue')
    signedIn()
    const save = deferred<Response>()
    fetchWithUnifiedRemint.mockImplementation(async (_url, init) =>
      init.method === 'POST' ? save.promise : settingResponse(false)
    )

    const first = useAgentConsent().resumeAcceptAfterReload()
    await vi.waitFor(() =>
      expect(fetchWithUnifiedRemint).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: 'POST' }),
        false
      )
    )
    await useAgentConsent().resumeAcceptAfterReload()
    const onSend = vi.fn()
    await useAgentConsent().withConsent('first_message', onSend)

    expect(useDialogStore().dialogStack).toHaveLength(0)
    expect(onSend).not.toHaveBeenCalled()
    expect(sessionStorage.getItem(PENDING_KEY)).not.toBeNull()
    expect(fetchWithUnifiedRemint).toHaveBeenCalledTimes(2)
    save.resolve(savedResponse())
    await first
    expect(useAgentConsentStore().accepted).toBe(true)
    expect(sessionStorage.getItem(PENDING_KEY)).toBeNull()
  })

  it.for([
    {
      content: 'attachment',
      arrange: () =>
        useAgentComposerStore().addAttachment({
          id: 'new-image',
          name: 'new.png',
          ref: 'new.png',
          previewUrl: 'blob:new'
        }),
      verify: () =>
        expect(useAgentComposerStore().attachments).toMatchObject([
          { id: 'new-image', previewUrl: 'blob:new' }
        ])
    },
    {
      content: 'reference',
      arrange: () => {
        useAgentComposerStore().setNodeScope('workflow-a')
        useAgentComposerStore().setNodes([{ id: '7', title: 'New node' }])
        useAgentComposerStore().setText('')
      },
      verify: () =>
        expect(useAgentComposerStore().nodes).toEqual([
          { id: '7', title: 'New node' }
        ])
    }
  ])(
    'preserves a newer $content when text is empty',
    async ({ arrange, verify }) => {
      storePending('make it blue')
      signedIn()
      arrange()

      await useAgentConsent().resumeAcceptAfterReload()

      expect(useAgentComposerStore().draft).toBe('')
      verify()
    }
  )

  it.for([
    {
      platform: 'legacy Desktop',
      desktop: true,
      cloud: false,
      bridge: undefined,
      opensSignIn: false
    },
    {
      platform: 'modern local Desktop',
      desktop: false,
      cloud: false,
      bridge: { isRemote: () => false },
      opensSignIn: false
    },
    {
      platform: 'Cloud',
      desktop: false,
      cloud: true,
      bridge: undefined,
      opensSignIn: true
    },
    {
      platform: 'remote Desktop',
      desktop: false,
      cloud: false,
      bridge: { isRemote: () => true },
      opensSignIn: true
    },
    {
      platform: 'local browser',
      desktop: false,
      cloud: false,
      bridge: undefined,
      opensSignIn: true
    }
  ])(
    'handles storage failure before $platform sign-in',
    async ({ desktop, cloud, bridge, opensSignIn }) => {
      distribution.isDesktop = desktop
      distribution.isCloud = cloud
      vi.stubGlobal('__comfyDesktop2', bridge)
      signedOut()
      holdDraft('make it blue')
      const error = new DOMException('Storage is full', 'QuotaExceededError')
      vi.spyOn(sessionStorage, 'setItem').mockImplementation(() => {
        throw error
      })
      vi.mocked(useAuthDialogs().showSignInDialog).mockResolvedValueOnce(false)
      const notify = vi.spyOn(useToast(), 'error')

      const request = useAgentConsent().withConsent('first_message', vi.fn())
      await startConsent()
      await request

      expect(useAuthDialogs().showSignInDialog).toHaveBeenCalledTimes(
        Number(opensSignIn)
      )
      expect(notify).toHaveBeenCalledTimes(Number(!opensSignIn))
      expect(useAgentComposerStore().submission?.snapshot.prompt.text).toBe(
        'make it blue'
      )
    }
  )

  it('recovers the first-page draft through another reload during the real save', async () => {
    signedOut()
    holdDraft('make it blue')
    const signIn = deferred<boolean>()
    vi.mocked(useAuthDialogs().showSignInDialog).mockReturnValueOnce(
      signIn.promise
    )
    const onSend = vi.fn()
    const original = useAgentConsent().withConsent('first_message', onSend)
    await startConsent()
    await vi.waitFor(() =>
      expect(useAuthDialogs().showSignInDialog).toHaveBeenCalledOnce()
    )

    function reloadConsentStores() {
      const pinia = getActivePinia()
      assert.exists(pinia)
      const stores = [
        useAgentComposerStore(),
        useAgentConsentStore(),
        useAgentConsentIntroductionStore()
      ]
      stores.forEach((store) => {
        store.$dispose()
        delete pinia.state.value[store.$id]
      })
    }
    reloadConsentStores()
    signedIn()
    const save = deferred<Response>()
    fetchWithUnifiedRemint.mockImplementation(async (_url, init) =>
      init.method === 'POST' ? save.promise : settingResponse(false)
    )
    const firstReload = useAgentConsent().resumeAcceptAfterReload()
    await vi.waitFor(() =>
      expect(fetchWithUnifiedRemint).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: 'POST' }),
        false
      )
    )

    expect(sessionStorage.getItem(PENDING_KEY)).not.toBeNull()
    reloadConsentStores()
    fetchWithUnifiedRemint.mockImplementation(async () => savedResponse())
    await useAgentConsent().resumeAcceptAfterReload()

    expect(useAgentConsentStore().accepted).toBe(true)
    expect(useAgentComposerStore().draft).toBe('make it blue')
    expect(useAgentComposerStore().submission).toBeNull()
    expect(
      fetchWithUnifiedRemint.mock.calls.map(([, init]) => init.method ?? 'GET')
    ).toEqual(['GET', 'POST', 'GET'])
    expect(onSend).not.toHaveBeenCalled()
    save.resolve(savedResponse())
    await firstReload
    signIn.resolve(false)
    await original
  })

  it.for([
    { change: 'account', userId: 'account-b', workspaceId: 'workspace-a' },
    { change: 'workspace', userId: 'account-a', workspaceId: 'workspace-b' }
  ])(
    'invalidates a bound accept after an $change change on reload',
    async ({ userId, workspaceId }) => {
      sessionStorage.setItem(
        PENDING_KEY,
        JSON.stringify({
          draft: 'make it blue',
          savedAt: Date.now(),
          scope: { userId: 'account-a', workspaceId: 'workspace-a' }
        })
      )
      useCurrentUser().isLoggedIn = computed(() => true)
      useCurrentUser().resolvedUserInfo = computed(() => ({ id: userId }))
      Object.assign(useTeamWorkspaceStore(), { activeWorkspaceId: workspaceId })

      await useAgentConsent().resumeAcceptAfterReload()

      expect(fetchWithUnifiedRemint).not.toHaveBeenCalled()
      expect(useAgentComposerStore().draft).toBe('')
      expect(sessionStorage.getItem(PENDING_KEY)).toBeNull()
    }
  )

  it('does not accept for a workspace that changed during the consent read', async () => {
    storePending('make it blue')
    signedIn()
    const read = deferred<Response>()
    fetchWithUnifiedRemint.mockReturnValueOnce(read.promise)
    const resume = useAgentConsent().resumeAcceptAfterReload()
    await vi.waitFor(() =>
      expect(fetchWithUnifiedRemint).toHaveBeenCalledOnce()
    )

    Object.assign(useTeamWorkspaceStore(), {
      activeWorkspaceId: 'workspace-b',
      workspaceTransitionGeneration: 1
    })
    read.resolve(settingResponse(false))
    await resume
    await useAgentConsent().resumeAcceptAfterReload()

    expect(fetchWithUnifiedRemint).toHaveBeenCalledOnce()
    expect(useAgentConsentStore().accepted).toBe(false)
    expect(sessionStorage.getItem(PENDING_KEY)).toBeNull()
  })

  it('leaves a newer pending attempt intact when an older save completes', async () => {
    storePending('make it blue')
    signedIn()
    fetchWithUnifiedRemint.mockResolvedValueOnce(settingResponse(false))
    const save = deferred<Response>()
    fetchWithUnifiedRemint.mockReturnValueOnce(save.promise)
    const resume = useAgentConsent().resumeAcceptAfterReload()
    await vi.waitFor(() =>
      expect(fetchWithUnifiedRemint).toHaveBeenCalledTimes(2)
    )

    const newer = writePendingSignInAccept('new draft')
    save.resolve(savedResponse())
    await resume

    assert(newer.ok)
    expect(JSON.parse(sessionStorage.getItem(PENDING_KEY)!)).toEqual(
      newer.pending
    )
  })

  it.for([
    {
      action: 'reject',
      answer: (dialog: DialogInstance) =>
        (dialog.contentProps.onReject as () => void)()
    },
    { action: 'dismiss', answer: dismissConsent }
  ])(
    'cancels retained recovery when a later consent card is answered with $action',
    async ({ answer }) => {
      storePending('make it blue')
      signedIn()
      fetchWithUnifiedRemint.mockResolvedValueOnce(settingResponse(false))
      fetchWithUnifiedRemint.mockRejectedValueOnce(new Error('save failed'))
      await useAgentConsent().resumeAcceptAfterReload()
      expect(sessionStorage.getItem(PENDING_KEY)).not.toBeNull()

      const request = useAgentConsent().withConsent('first_message', vi.fn())
      answer(await waitForConsentDialog())
      await request
      await useAgentConsent().resumeAcceptAfterReload()

      expect(fetchWithUnifiedRemint).toHaveBeenCalledTimes(2)
      expect(sessionStorage.getItem(PENDING_KEY)).toBeNull()
      expect(useAgentConsentStore().accepted).toBe(false)
    }
  )

  it('restores editable text when workspace initialization fails before saving', async () => {
    storePending('make it blue')
    signedIn()
    Object.assign(useTeamWorkspaceStore(), { activeWorkspaceId: null })
    vi.mocked(useTeamWorkspaceStore().initialize).mockRejectedValueOnce(
      new Error('workspace unavailable')
    )

    await useAgentConsent().resumeAcceptAfterReload()

    expect(useAgentComposerStore().draft).toBe('make it blue')
    expect(sessionStorage.getItem(PENDING_KEY)).not.toBeNull()
    expect(fetchWithUnifiedRemint).not.toHaveBeenCalled()
    expect(reportError).toHaveBeenCalledWith(expect.any(Error), {
      surface: 'agent',
      errorType: 'agent_consent_setting_load_failure'
    })
    Object.assign(useTeamWorkspaceStore(), { activeWorkspaceId: 'workspace-a' })
    await useAgentConsent().resumeAcceptAfterReload()
    expect(useAgentConsentStore().accepted).toBe(true)
    expect(sessionStorage.getItem(PENDING_KEY)).toBeNull()
  })

  it('invalidates recovery without stale error feedback when initialization rejects after an account change', async () => {
    storePending('make it blue')
    const user = ref({ id: 'account-a' })
    useCurrentUser().resolvedUserInfo = computed(() => user.value)
    useCurrentUser().isLoggedIn = computed(() => true)
    Object.assign(useTeamWorkspaceStore(), { activeWorkspaceId: null })
    const initialization = deferred<void>()
    vi.mocked(useTeamWorkspaceStore().initialize).mockReturnValueOnce(
      initialization.promise
    )
    const notify = vi.spyOn(useToast(), 'error')
    const resume = useAgentConsent().resumeAcceptAfterReload()
    await vi.waitFor(() =>
      expect(useTeamWorkspaceStore().initialize).toHaveBeenCalledOnce()
    )

    user.value = { id: 'account-b' }
    initialization.reject(new Error('old workspace failed'))
    await resume
    Object.assign(useTeamWorkspaceStore(), { activeWorkspaceId: 'workspace-b' })
    await useAgentConsent().resumeAcceptAfterReload()

    expect(sessionStorage.getItem(PENDING_KEY)).toBeNull()
    expect(fetchWithUnifiedRemint).not.toHaveBeenCalled()
    expect(notify).not.toHaveBeenCalled()
    expect(reportError).not.toHaveBeenCalled()
  })

  it('does not reuse an initialization failure for another account on a later retry', async () => {
    storePending('make it blue')
    const user = ref({ id: 'account-a' })
    useCurrentUser().resolvedUserInfo = computed(() => user.value)
    useCurrentUser().isLoggedIn = computed(() => true)
    Object.assign(useTeamWorkspaceStore(), { activeWorkspaceId: null })
    vi.mocked(useTeamWorkspaceStore().initialize).mockRejectedValueOnce(
      new Error('workspace unavailable')
    )
    await useAgentConsent().resumeAcceptAfterReload()
    expect(sessionStorage.getItem(PENDING_KEY)).not.toBeNull()

    user.value = { id: 'account-b' }
    Object.assign(useTeamWorkspaceStore(), { activeWorkspaceId: 'workspace-b' })
    await useAgentConsent().resumeAcceptAfterReload()

    expect(fetchWithUnifiedRemint).not.toHaveBeenCalled()
    expect(sessionStorage.getItem(PENDING_KEY)).toBeNull()
    expect(useAgentConsentStore().accepted).toBe(false)
  })
})
