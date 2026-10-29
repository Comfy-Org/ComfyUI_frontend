import { fromPartial } from '@total-typescript/shoehorn'
vi.mock(import('firebase/auth'))
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi
} from 'vitest'
import type { Mocked } from 'vitest'
import { computed, defineComponent, effectScope, nextTick, ref } from 'vue'
import type { EffectScope } from 'vue'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'
let setupScope: EffectScope
import { useAgentConsentStore } from '@/workbench/extensions/agent/stores/agent/agentConsentStore'
import { useAgentConsentIntroductionStore } from '@/workbench/extensions/agent/stores/agent/agentConsentIntroductionStore'
import { registerWorkflowTabActivityTracker } from '@/workbench/extensions/agent/services/agent/workflowTabActivityTracker'

import type { ComfyExtension } from '@/types/comfy'
import { useOnboardingTourStore } from '@/platform/onboarding/onboardingTourStore'
import type { EntryPath } from '@/platform/onboarding/onboardingTours'
import type { useFirstRunEntry } from '@/renderer/extensions/firstRunTour/gettingStarted/firstRunEntry'
import {
  CONSENT_DIALOG_KEY,
  useAgentConsent
} from '@/workbench/extensions/agent/composables/agent/useAgentConsent'
import type { ConsentOfferHooks } from '@/workbench/extensions/agent/composables/agent/useAgentConsent'
import { useTelemetry } from '@comfyorg/telemetry'
import type { AgentConsentTrigger } from '@comfyorg/telemetry/types'
import type { useExtensionService } from '@/platform/extensions/services/extensionService'
import { LGraph, LGraphNode } from '@comfyorg/litegraph/litegraph'
import { createTestSubgraph } from '@comfyorg/litegraph/subgraph/__fixtures__/subgraphHelpers'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useAgentComposerStore } from '@/workbench/extensions/agent/stores/agent/agentComposerStore'
import { useDialogStore } from '@/stores/dialogStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'
import { createMockLoadedWorkflow } from '@/utils/__tests__/workflowTestUtils'
import {
  createMockCanvasRenderingContext2D,
  createTestCanvas
} from '@comfyorg/litegraph/__fixtures__/canvasTestUtils'
import { toNodeId } from '@comfyorg/graph-model/nodeId'
import { createNodeLocatorId } from '@comfyorg/graph-model/nodeIdentification'

let agentStore: Mocked<ReturnType<typeof useAgentPanelStore>>
let workflowStore: ReturnType<typeof useWorkflowStore>
let consentStore: ReturnType<typeof useAgentConsentStore>
let workspaceStore: ReturnType<typeof useTeamWorkspaceStore>

const currentUser = ref<{ id: string } | null>({ id: 'account-a' })
const isAuthInitialized = ref(true)
type FirstRunScreenState = 'released' | 'visible' | 'handoff'
const firstRunScreenState = ref<FirstRunScreenState>('released')
const gettingStartedVisible = computed(
  () => firstRunScreenState.value === 'visible'
)
const firstRunHoldsScreen = computed(
  () => firstRunScreenState.value !== 'released'
)
const activeTour = ref<EntryPath | null>(null)
let startupDecision: Promise<boolean> = Promise.resolve(true)
const ACTIVATION_VISITS_STORAGE_KEY = 'Comfy.AgentPanel.activationVisits'

function showFirstRunScreen(): void {
  firstRunScreenState.value = 'visible'
}

function releaseFirstRunScreen(): void {
  firstRunScreenState.value = 'released'
}

function beginFirstRunScreenHandoff(): void {
  firstRunScreenState.value = 'handoff'
}

vi.mock(import('@/composables/auth/useCurrentUser'))

vi.mock(import('@comfyorg/telemetry'))

vi.mock(
  import('@/workbench/extensions/agent/composables/agent/useAgentConsent'),
  { spy: true }
)

const mockedConsent = fromPartial<ReturnType<typeof useAgentConsent>>({
  withConsent: vi.fn(
    async (
      _trigger: AgentConsentTrigger,
      onAccept: () => void,
      hooks?: ConsentOfferHooks
    ) => {
      if (hooks?.canShow?.() === false) return
      onAccept()
    }
  ),
  resumeAcceptAfterReload: vi.fn(async () => {})
})
let realResumeAcceptAfterReload: ReturnType<
  typeof useAgentConsent
>['resumeAcceptAfterReload']

const mocks = vi.hoisted(() => ({
  capturedExtensions: [] as ComfyExtension[],
  failNextRegistration: false,
  isCloud: true,
  isDesktop: false
}))

vi.mock(import('@/platform/distribution/types'), () => ({
  DISTRIBUTION: __DISTRIBUTION__,
  get isCloud() {
    return mocks.isCloud
  },
  isNightly: __IS_NIGHTLY__,
  get isDesktop() {
    return mocks.isDesktop
  }
}))

vi.mock(
  import('@/renderer/extensions/firstRunTour/gettingStarted/firstRunEntry'),
  () => ({
    useFirstRunEntry: () =>
      fromPartial<ReturnType<typeof useFirstRunEntry>>({
        gettingStartedVisible,
        firstRunHoldsScreen,
        whenStartupDecided: () => startupDecision
      })
  })
)

vi.mock(import('@/platform/extensions/services/extensionService'), () => ({
  useExtensionService: () =>
    fromPartial<ReturnType<typeof useExtensionService>>({
      registerExtension: (ext: ComfyExtension) => {
        if (mocks.failNextRegistration) {
          mocks.failNextRegistration = false
          throw new Error(`Extension named '${ext.name}' already registered.`)
        }
        mocks.capturedExtensions.push(ext)
      }
    })
}))

vi.mock(
  import('@/workbench/extensions/agent/services/agent/workflowTabActivityTracker'),
  () => ({
    registerWorkflowTabActivityTracker: vi.fn(() => () => {})
  })
)

const READY_AGENT = { state: 'ready', reason: null } as const

function setAgentReady(ready: boolean): void {
  Object.assign(agentStore, {
    comfyAgent: ready ? { ...READY_AGENT } : undefined
  })
}

const { registerAgentPanelExtension } = await import('./agentPanel')
const importRegistrationCount = mocks.capturedExtensions.length

function attemptRegistration(): unknown {
  try {
    registerAgentPanelExtension()
  } catch (error) {
    return error
  }
}

mocks.failNextRegistration = true
const failedRegistrationError = attemptRegistration()
registerAgentPanelExtension()
const registrationsAfterRetry = mocks.capturedExtensions.length

const flush = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 0))

const notOffered = async () =>
  vi.mocked(
    (await import('@comfyorg/telemetry')).useTelemetry()!
      .trackAgentConsentNotOffered
  )

const offerExited = async () =>
  vi.mocked(
    (await import('@comfyorg/telemetry')).useTelemetry()!
      .trackAgentConsentOfferExited
  )

async function loadEntryAndSetup(): Promise<void> {
  registerAgentPanelExtension()
  const ext = mocks.capturedExtensions.find(
    (e) => e.name === 'Comfy.AgentPanel'
  )
  expect(ext).toBeDefined()
  await setupScope.run(() =>
    ext!.setup!({} as Parameters<NonNullable<ComfyExtension['setup']>>[0])
  )
  await nextTick()
}

const DESKTOP_APPROVAL_KEY = 'global-desktop-login-confirm'
const EmptyDialog = defineComponent(() => () => null)

function openDialog(key = DESKTOP_APPROVAL_KEY): void {
  useDialogStore().showDialog({ key, component: EmptyDialog })
}

function closeDialog(key = DESKTOP_APPROVAL_KEY): void {
  useDialogStore().closeDialog({ key })
}

describe('AgentPanel extension flag gate', () => {
  afterEach(() => {
    setupScope.stop()
  })

  beforeEach(() => {
    const currentUserService = vi.mocked(useCurrentUser())
    currentUserService.resolvedUserInfo = computed(() => currentUser.value)
    currentUserService.isAuthInitialized = computed(
      () => isAuthInitialized.value
    )
    currentUserService.isLoggedIn = computed(() => currentUser.value !== null)
    mocks.isCloud = true
    mocks.isDesktop = false
    setupScope = effectScope()
    currentUser.value = { id: 'account-a' }
    isAuthInitialized.value = true
    consentStore = useAgentConsentStore()
    realResumeAcceptAfterReload = useAgentConsent().resumeAcceptAfterReload
    vi.mocked(useAgentConsent).mockReturnValue(mockedConsent)
    workspaceStore = useTeamWorkspaceStore()
    Object.assign(workspaceStore, {
      activeWorkspaceId: 'workspace-a',
      isSwitching: false
    })
    Object.assign(consentStore, { accepted: true })
    Object.assign(consentStore, { identity: 'account-a/workspace-a' })
    vi.mocked(consentStore.load).mockResolvedValue(false)
    agentStore = vi.mocked(useAgentPanelStore())
    agentStore.consentAccepted = false
    workflowStore = useWorkflowStore()
    agentStore.close.mockClear()
    agentStore.enabled = false
    Object.assign(agentStore, { comfyAgent: undefined })
    agentStore.isOpen = true
    setAgentReady(false)
    releaseFirstRunScreen()
    activeTour.value = null
    startupDecision = Promise.resolve(true)
    vi.spyOn(useOnboardingTourStore(), 'activeTour', 'get').mockImplementation(
      () => activeTour.value
    )
    localStorage.clear()
    useCanvasStore().stopNodePicking()
    workflowStore.activeWorkflow = createMockLoadedWorkflow({
      instanceId: 'first-workflow-instance',
      path: 'workflows/first.json'
    })
  })

  describe.for([
    { platform: 'Cloud', cloud: true, desktop: false },
    { platform: 'Desktop', cloud: false, desktop: true }
  ])('startup consent card on $platform', ({ cloud, desktop }) => {
    beforeEach(() => {
      mocks.isCloud = cloud
      mocks.isDesktop = desktop
      setAgentReady(true)
      Object.assign(consentStore, { accepted: false, isChecking: false })
      agentStore.isOpen = false
      vi.mocked(useAgentConsent().withConsent).mockImplementation(
        async (_trigger, _onAccept, hooks) => {
          if (hooks?.canShow?.() === false) return
        }
      )
    })

    it('does not show the startup card once the agent stops being ready before it mounts', async () => {
      currentUser.value = null
      let canShow: boolean | undefined
      vi.mocked(useAgentConsent().withConsent).mockImplementationOnce(
        async (_trigger, _onAccept, hooks) => {
          setAgentReady(false)
          await nextTick()
          canShow = hooks?.canShow?.()
        }
      )

      await loadEntryAndSetup()
      await flush()

      expect(useAgentConsent().withConsent).toHaveBeenCalledOnce()
      expect(canShow).toBe(false)
    })

    it('reports nothing after the panel-opening launches for a scope that already answered', async () => {
      currentUser.value = { id: 'account-a' }
      localStorage.setItem(ACTIVATION_VISITS_STORAGE_KEY, '2')
      localStorage.setItem(
        'Comfy.AgentConsent.IntroductionResponded.account-a.workspace-a',
        'true'
      )

      await loadEntryAndSetup()
      await flush()

      expect(useAgentConsent().withConsent).not.toHaveBeenCalled()
      expect(await offerExited()).not.toHaveBeenCalled()
    })

    it('does not introduce the agent after the user signs out during the page', async () => {
      currentUser.value = { id: 'account-a' }

      await loadEntryAndSetup()
      await flush()
      expect(useAgentConsent().withConsent).toHaveBeenCalledOnce()

      currentUser.value = null
      await flush()

      expect(useAgentConsent().withConsent).toHaveBeenCalledOnce()
    })

    it('reports nothing when a user past the automatic launches signs out', async () => {
      currentUser.value = { id: 'account-a' }
      localStorage.setItem(ACTIVATION_VISITS_STORAGE_KEY, '2')
      localStorage.setItem(
        'Comfy.AgentConsent.IntroductionResponded.account-a.workspace-a',
        'true'
      )

      await loadEntryAndSetup()
      await flush()
      currentUser.value = null
      await flush()

      expect(useAgentConsent().withConsent).not.toHaveBeenCalled()
      expect(await offerExited()).not.toHaveBeenCalled()
    })

    it('does not introduce the agent when the user signs out before the startup decision', async () => {
      currentUser.value = { id: 'account-a' }
      let decideStartup!: (decided: boolean) => void
      startupDecision = new Promise((resolve) => {
        decideStartup = resolve
      })

      await loadEntryAndSetup()
      await flush()
      currentUser.value = null
      await flush()
      decideStartup(true)
      await flush()

      expect(useAgentConsent().withConsent).not.toHaveBeenCalled()
    })

    it('does not show a queued card after the user signs out', async () => {
      currentUser.value = { id: 'account-a' }
      let canShow: boolean | undefined
      vi.mocked(useAgentConsent().withConsent).mockImplementationOnce(
        async (_trigger, _onAccept, hooks) => {
          currentUser.value = null
          await nextTick()
          canShow = hooks?.canShow?.()
        }
      )

      await loadEntryAndSetup()
      await flush()

      expect(useAgentConsent().withConsent).toHaveBeenCalledOnce()
      expect(canShow).toBe(false)
    })

    it('drops a held offer once its scope has answered', async () => {
      currentUser.value = { id: 'account-a' }
      activeTour.value = 'appMode'

      await loadEntryAndSetup()
      await flush()
      expect(useAgentConsent().withConsent).not.toHaveBeenCalled()
      expect(consentStore.load).toHaveBeenCalledOnce()

      localStorage.setItem(
        'Comfy.AgentConsent.IntroductionResponded.account-a.workspace-a',
        'true'
      )
      setAgentReady(false)
      await nextTick()
      setAgentReady(true)
      await flush()
      vi.mocked(consentStore.load).mockClear()

      activeTour.value = null
      await flush()

      expect(consentStore.load).not.toHaveBeenCalled()
      expect(useAgentConsent().withConsent).not.toHaveBeenCalled()
    })

    it('shows no startup card after the panel-opening launches, even with the panel left open', async () => {
      currentUser.value = { id: 'account-a' }
      localStorage.setItem(ACTIVATION_VISITS_STORAGE_KEY, '2')
      agentStore.isOpen = true

      await loadEntryAndSetup()
      await flush()

      expect(useAgentConsent().withConsent).not.toHaveBeenCalled()
      expect(await offerExited()).toHaveBeenCalledWith({
        exit: 'activation_window_complete',
        stage: 'startup',
        retry_armed: false
      })
    })

    it.for([
      { session: 'signed out', user: null, visits: '0' },
      {
        session: 'signed in on first visit',
        user: { id: 'account-a' },
        visits: '0'
      },
      {
        session: 'signed in on second visit',
        user: { id: 'account-a' },
        visits: '1'
      }
    ])('offers consent on startup when $session', async ({ user, visits }) => {
      currentUser.value = user
      localStorage.setItem(ACTIVATION_VISITS_STORAGE_KEY, visits)

      await loadEntryAndSetup()
      await flush()

      expect(useAgentConsent().withConsent).toHaveBeenCalledOnce()
      expect(agentStore.isVisible).toBe(true)
      expect(vi.mocked(useAgentConsent().withConsent).mock.calls[0][0]).toBe(
        'first_load'
      )
    })

    it.for([
      { session: 'signed out', user: null },
      { session: 'signed in', user: { id: 'account-a' } }
    ])(
      'leaves the panel and card closed when $session after the two activation visits',
      async ({ user }) => {
        currentUser.value = user
        localStorage.setItem(ACTIVATION_VISITS_STORAGE_KEY, '2')

        await loadEntryAndSetup()
        await flush()

        expect(agentStore.isVisible).toBe(false)
        expect(useAgentConsent().withConsent).not.toHaveBeenCalled()
      }
    )

    it.for([
      { surface: 'dialog', hold: openDialog, release: closeDialog },
      {
        surface: 'tour',
        hold: () => {
          activeTour.value = 'appMode'
        },
        release: () => {
          activeTour.value = null
        }
      }
    ])(
      'waits for an active $surface before offering signed-out consent',
      async ({ hold, release }) => {
        currentUser.value = null
        hold()

        await loadEntryAndSetup()
        await flush()
        expect(useAgentConsent().withConsent).not.toHaveBeenCalled()

        release()
        await flush()

        expect(useAgentConsent().withConsent).toHaveBeenCalledOnce()
      }
    )

    it('queues consent after sign-in from another entry despite a previous introduction response', async () => {
      currentUser.value = null
      localStorage.setItem(
        'Comfy.AgentConsent.IntroductionResponded.signed-out',
        'true'
      )

      await loadEntryAndSetup()
      await flush()
      expect(useAgentConsent().withConsent).not.toHaveBeenCalled()

      agentStore.close('close_button')

      currentUser.value = { id: 'account-b' }
      Object.assign(workspaceStore, { activeWorkspaceId: 'workspace-b' })
      Object.assign(consentStore, { identity: 'account-b/workspace-b' })
      await flush()

      expect(useAgentConsent().withConsent).toHaveBeenCalledOnce()
      expect(agentStore.isVisible).toBe(false)
      expect(
        localStorage.getItem(
          'Comfy.AgentConsent.IntroductionResponded.signed-out'
        )
      ).toBe('true')
    })

    it.for([
      {
        restore: 'auth',
        user: null,
        initialized: false,
        workspaceId: 'workspace-a'
      },
      {
        restore: 'workspace',
        user: { id: 'account-a' },
        initialized: true,
        workspaceId: null
      }
    ])(
      'opens only the startup panel when initial $restore arrives late after an earlier Skip',
      async ({ user, initialized, workspaceId }) => {
        currentUser.value = user
        isAuthInitialized.value = initialized
        Object.assign(workspaceStore, { activeWorkspaceId: workspaceId })
        Object.assign(consentStore, { identity: null })
        localStorage.setItem(
          'Comfy.AgentConsent.IntroductionResponded.account-a.workspace-a',
          'true'
        )
        localStorage.setItem(ACTIVATION_VISITS_STORAGE_KEY, '1')
        await loadEntryAndSetup()
        await flush()

        currentUser.value = { id: 'account-a' }
        Object.assign(workspaceStore, { activeWorkspaceId: 'workspace-a' })
        Object.assign(consentStore, { identity: 'account-a/workspace-a' })
        isAuthInitialized.value = true
        await flush()

        expect(agentStore.isVisible).toBe(true)
        expect(useAgentConsent().withConsent).not.toHaveBeenCalled()
      }
    )

    it('keeps an external sign-in queued until its workspace resolves', async () => {
      currentUser.value = null
      Object.assign(consentStore, { identity: null })
      localStorage.setItem(
        'Comfy.AgentConsent.IntroductionResponded.signed-out',
        'true'
      )
      await loadEntryAndSetup()
      await flush()
      openDialog()

      currentUser.value = { id: 'account-b' }
      await flush()
      Object.assign(consentStore, { identity: 'account-b/workspace-b' })
      await flush()
      closeDialog()
      await flush()

      expect(useAgentConsent().withConsent).toHaveBeenCalledOnce()
    })

    it.for([
      { session: 'signed out', user: null },
      { session: 'signed in', user: { id: 'account-a' } }
    ])(
      'remembers a $session Skip across launches and opens the panel only for the two activation visits',
      async ({ user }) => {
        currentUser.value = user
        vi.mocked(useAgentConsent().withConsent).mockImplementationOnce(
          async (_trigger, _onAccept, hooks) => {
            if (hooks?.canShow?.() === false) return
            useAgentConsentIntroductionStore().markResponded()
          }
        )
        const relaunch = async (): Promise<void> => {
          agentStore.close('close_button')
          setupScope.stop()
          setupScope = effectScope()
          await loadEntryAndSetup()
          await flush()
        }

        await loadEntryAndSetup()
        await flush()
        expect(useAgentConsent().withConsent).toHaveBeenCalledOnce()
        expect(agentStore.isVisible).toBe(true)

        await relaunch()
        expect(agentStore.isVisible).toBe(true)
        expect(localStorage.getItem(ACTIVATION_VISITS_STORAGE_KEY)).toBe('2')
        expect(useAgentConsent().withConsent).toHaveBeenCalledOnce()

        await relaunch()
        expect(agentStore.isVisible).toBe(false)
        expect(useAgentConsent().withConsent).toHaveBeenCalledOnce()
      }
    )

    it.for([
      { state: 'unknown', agent: undefined },
      { state: 'starting', agent: { state: 'starting', reason: null } },
      { state: 'failed', agent: { state: 'failed', reason: 'not_found' } }
    ] as const)(
      'does not offer or open for $state, but recovers on late readiness',
      async ({ agent }) => {
        currentUser.value = null
        Object.assign(agentStore, { comfyAgent: agent, flagsSettled: true })

        await loadEntryAndSetup()
        await flush()
        expect(agentStore.isVisible).toBe(false)
        expect(useAgentConsent().withConsent).not.toHaveBeenCalled()

        setAgentReady(true)
        await flush()
        expect(agentStore.isVisible).toBe(true)
        expect(useAgentConsent().withConsent).toHaveBeenCalledOnce()
      }
    )

    it('offers again on a later startup when the earlier card was only dismissed', async () => {
      currentUser.value = null
      vi.mocked(useAgentConsent().withConsent).mockImplementation(async () => {
        openDialog(CONSENT_DIALOG_KEY)
        await nextTick()
        closeDialog(CONSENT_DIALOG_KEY)
      })

      await loadEntryAndSetup()
      await flush()
      expect(useAgentConsent().withConsent).toHaveBeenCalledOnce()
      expect(
        useAgentConsentIntroductionStore().hasResponded('signed-out')
      ).toBe(false)
      setAgentReady(true)
      await flush()
      expect(useAgentConsent().withConsent).toHaveBeenCalledOnce()
      setupScope.stop()
      setupScope = effectScope()

      await loadEntryAndSetup()
      await flush()

      expect(useAgentConsent().withConsent).toHaveBeenCalledTimes(2)
      expect(
        useAgentConsentIntroductionStore().hasResponded('signed-out')
      ).toBe(false)
    })

    it('waits for auth initialization before treating startup as signed out', async () => {
      currentUser.value = null
      isAuthInitialized.value = false

      await loadEntryAndSetup()
      await flush()
      expect(useAgentConsent().withConsent).not.toHaveBeenCalled()

      isAuthInitialized.value = true
      await flush()

      expect(useAgentConsent().withConsent).toHaveBeenCalledOnce()
    })

    it('suppresses a deferred introduction after a manual response', async () => {
      currentUser.value = null
      showFirstRunScreen()

      await loadEntryAndSetup()
      await flush()
      expect(useAgentConsent().withConsent).not.toHaveBeenCalled()

      useAgentConsentIntroductionStore().markResponded()
      releaseFirstRunScreen()
      await flush()

      expect(useAgentConsent().withConsent).not.toHaveBeenCalled()
    })

    it('does not ask again while a signed-out acceptance continues through sign-in', async () => {
      currentUser.value = null
      localStorage.setItem(
        'Comfy.AgentConsent.IntroductionResponded.signed-out',
        'true'
      )
      Object.assign(useAgentConsentIntroductionStore(), {
        isContinuingSignIn: true
      })
      await loadEntryAndSetup()
      await flush()

      currentUser.value = { id: 'account-b' }
      Object.assign(consentStore, { identity: 'account-b/workspace-a' })
      await flush()
      expect(useAgentConsent().withConsent).not.toHaveBeenCalled()

      Object.assign(consentStore, { accepted: true })
      Object.assign(useAgentConsentIntroductionStore(), {
        isContinuingSignIn: false
      })
      await flush()
      expect(useAgentConsent().withConsent).not.toHaveBeenCalled()
    })

    it('waits for server readiness before offering signed-out consent', async () => {
      currentUser.value = null
      setAgentReady(false)

      await loadEntryAndSetup()
      await flush()
      expect(useAgentConsent().withConsent).not.toHaveBeenCalled()

      setAgentReady(true)
      await flush()

      expect(useAgentConsent().withConsent).toHaveBeenCalledOnce()
    })

    it('defers signed-out consent until startup and the first-run screen release', async () => {
      currentUser.value = null
      showFirstRunScreen()
      let decide = (_: boolean) => {}
      startupDecision = new Promise<boolean>((resolve) => {
        decide = resolve
      })

      await loadEntryAndSetup()
      await flush()
      expect(useAgentConsent().withConsent).not.toHaveBeenCalled()
      decide(true)
      await flush()
      expect(useAgentConsent().withConsent).not.toHaveBeenCalled()

      releaseFirstRunScreen()
      await flush()

      expect(useAgentConsent().withConsent).toHaveBeenCalledOnce()
    })
  })

  it('attributes automatic acceptance with a restored open preference to the consent card', async () => {
    setAgentReady(true)
    Object.assign(consentStore, { accepted: false, isChecking: false })
    vi.mocked(useAgentConsent().withConsent).mockImplementationOnce(
      async (_trigger, onAccept) => {
        await Promise.resolve().then(() => {
          Object.assign(consentStore, { accepted: true })
        })
        onAccept()
      }
    )
    expect(agentStore.isOpen).toBe(true)

    await loadEntryAndSetup()
    await vi.waitFor(() => expect(agentStore.isVisible).toBe(true))

    expect(useAgentConsent().withConsent).toHaveBeenCalledOnce()
    expect(vi.mocked(useAgentConsent().withConsent).mock.calls[0][0]).toBe(
      'first_load'
    )
    expect(agentStore.open).not.toHaveBeenCalled()
    expect(
      useTelemetry()?.trackAgentPanelOpened
    ).toHaveBeenCalledExactlyOnceWith({ source: 'restored' })
  })

  it.for([
    { session: 'cloud logged in without consent', user: { id: 'account-a' } },
    { session: 'local logged out', user: null }
  ])('opens after startup for $session', async ({ user }) => {
    setAgentReady(true)
    currentUser.value = user
    Object.assign(consentStore, { accepted: false, isChecking: false })
    agentStore.isOpen = false
    vi.mocked(useAgentConsent().withConsent).mockImplementation(
      () => new Promise(() => {})
    )

    await loadEntryAndSetup()
    await vi.waitFor(() =>
      expect(agentStore.open).toHaveBeenCalledWith('activation')
    )

    expect(agentStore.isVisible).toBe(true)
    expect(localStorage.getItem(ACTIVATION_VISITS_STORAGE_KEY)).toBe('1')
    await vi.waitFor(() =>
      expect(useAgentConsent().withConsent).toHaveBeenCalledWith(
        'first_load',
        expect.any(Function),
        expect.any(Object)
      )
    )
  })

  it('waits for the general onboarding decision before activation', async () => {
    setAgentReady(true)
    agentStore.isOpen = false
    let decide = (_: boolean) => {}
    startupDecision = new Promise<boolean>((resolve) => {
      decide = resolve
    })

    await loadEntryAndSetup()
    expect(agentStore.open).not.toHaveBeenCalled()

    decide(true)
    await vi.waitFor(() =>
      expect(agentStore.open).toHaveBeenCalledExactlyOnceWith('activation')
    )
  })

  it('opens again on the second visit and completes the discovery window', async () => {
    localStorage.setItem(ACTIVATION_VISITS_STORAGE_KEY, '1')
    setAgentReady(true)
    agentStore.isOpen = false

    await loadEntryAndSetup()
    await vi.waitFor(() =>
      expect(agentStore.open).toHaveBeenCalledExactlyOnceWith('activation')
    )

    expect(localStorage.getItem(ACTIVATION_VISITS_STORAGE_KEY)).toBe('2')
  })

  it('counts a visit when the persisted panel is already open', async () => {
    localStorage.setItem(ACTIVATION_VISITS_STORAGE_KEY, '1')
    setAgentReady(true)
    Object.assign(consentStore, { accepted: true, isChecking: false })
    agentStore.isOpen = true

    await loadEntryAndSetup()
    await vi.waitFor(() =>
      expect(localStorage.getItem(ACTIVATION_VISITS_STORAGE_KEY)).toBe('2')
    )

    expect(agentStore.open).not.toHaveBeenCalled()
  })

  it('preserves a closed preference after the two-visit discovery window', async () => {
    localStorage.setItem(ACTIVATION_VISITS_STORAGE_KEY, '2')
    setAgentReady(true)
    Object.assign(consentStore, { accepted: false, isChecking: false })
    agentStore.isOpen = false
    let finishConsentRead = (_: boolean) => {}
    const consentRead = new Promise<boolean>((resolve) => {
      finishConsentRead = resolve
    })
    vi.mocked(consentStore.load).mockReturnValueOnce(consentRead)
    let decideStartup = (_: boolean) => {}
    startupDecision = new Promise<boolean>((resolve) => {
      decideStartup = resolve
    })

    await loadEntryAndSetup()
    await vi.waitFor(() => expect(consentStore.load).toHaveBeenCalledOnce())
    finishConsentRead(false)
    await consentRead
    decideStartup(true)
    await startupDecision

    expect(agentStore.isOpen).toBe(false)
    expect(agentStore.open).not.toHaveBeenCalled()
    expect(useAgentConsent().withConsent).not.toHaveBeenCalled()
    expect(localStorage.getItem(ACTIVATION_VISITS_STORAGE_KEY)).toBe('2')
    expect(await offerExited()).toHaveBeenCalledWith({
      exit: 'activation_window_complete',
      stage: 'startup',
      retry_armed: false
    })
  })

  it('keeps a second-visit panel closed when consent finishes after dismissal', async () => {
    localStorage.setItem(ACTIVATION_VISITS_STORAGE_KEY, '1')
    setAgentReady(true)
    Object.assign(consentStore, { accepted: false, isChecking: false })
    agentStore.isOpen = true
    let accept = () => {}
    let finish = () => {}
    const pending = new Promise<void>((resolve) => {
      finish = resolve
    })
    vi.mocked(useAgentConsent().withConsent).mockImplementationOnce(
      async (_trigger, onAccept, hooks) => {
        hooks?.canShow?.()
        accept = onAccept
        await pending
      }
    )

    await loadEntryAndSetup()
    await vi.waitFor(() =>
      expect(useAgentConsent().withConsent).toHaveBeenCalledOnce()
    )
    await vi.waitFor(() =>
      expect(localStorage.getItem(ACTIVATION_VISITS_STORAGE_KEY)).toBe('2')
    )
    expect(agentStore.isOpen).toBe(true)

    agentStore.close('close_button')
    accept()
    finish()
    await pending

    expect(agentStore.isOpen).toBe(false)
    expect(agentStore.open).not.toHaveBeenCalled()
  })

  it('opens the panel on Agree when the second-visit card first appears over a closed panel', async () => {
    localStorage.setItem(ACTIVATION_VISITS_STORAGE_KEY, '1')
    setAgentReady(true)
    Object.assign(consentStore, { accepted: false, isChecking: false })
    agentStore.isOpen = true
    let show = () => {}
    vi.mocked(useAgentConsent().withConsent).mockImplementationOnce(
      async (_trigger, onAccept, hooks) => {
        await new Promise<void>((resolve) => {
          show = () => {
            if (hooks?.canShow?.() !== false) onAccept()
            resolve()
          }
        })
      }
    )

    await loadEntryAndSetup()
    await vi.waitFor(() =>
      expect(useAgentConsent().withConsent).toHaveBeenCalledOnce()
    )
    await vi.waitFor(() =>
      expect(localStorage.getItem(ACTIVATION_VISITS_STORAGE_KEY)).toBe('2')
    )

    agentStore.close('close_button')
    show()
    await flush()

    expect(agentStore.open).toHaveBeenCalledWith('automatic_consent')
    expect(agentStore.isOpen).toBe(true)
  })

  it('does not reopen a dismissed activation panel after flag synchronization', async () => {
    setAgentReady(true)
    agentStore.isOpen = false

    await loadEntryAndSetup()
    await vi.waitFor(() =>
      expect(agentStore.open).toHaveBeenCalledExactlyOnceWith('activation')
    )

    agentStore.close('close_button')
    setAgentReady(false)
    await nextTick()
    setAgentReady(true)
    await flush()

    expect(agentStore.isOpen).toBe(false)
    expect(agentStore.open).toHaveBeenCalledOnce()
  })

  it('keeps the panel closed if the feature is disabled before acceptance', async () => {
    setAgentReady(true)
    Object.assign(consentStore, { accepted: false, isChecking: false })
    let accept = () => {}
    let finish = () => {}
    const pending = new Promise<void>((resolve) => {
      finish = resolve
    })
    vi.mocked(useAgentConsent().withConsent).mockImplementationOnce(
      async (_trigger, onAccept) => {
        accept = onAccept
        await pending
      }
    )

    await loadEntryAndSetup()
    await vi.waitFor(() =>
      expect(useAgentConsent().withConsent).toHaveBeenCalledOnce()
    )
    setAgentReady(false)
    await nextTick()
    accept()
    finish()
    await pending

    expect(agentStore.open).not.toHaveBeenCalled()
  })

  it('offers once the gate flips on after starting off', async () => {
    Object.assign(consentStore, { accepted: false, isChecking: false })

    await loadEntryAndSetup()
    expect(useAgentConsent().withConsent).not.toHaveBeenCalled()

    setAgentReady(true)
    await nextTick()

    await vi.waitFor(() =>
      expect(useAgentConsent().withConsent).toHaveBeenCalledOnce()
    )
    expect(agentStore.open).not.toHaveBeenCalled()
  })

  it.for([
    {
      surface: 'the Getting Started screen is up',
      arrange: () => showFirstRunScreen()
    },
    {
      surface: 'a coachmark tour is active',
      arrange: () => void (activeTour.value = 'appMode')
    },
    {
      surface: 'the desktop sign-in approval is open',
      arrange: () => openDialog()
    }
  ])('withholds the automatic offer while $surface', async ({ arrange }) => {
    setAgentReady(true)
    arrange()
    Object.assign(consentStore, { accepted: false, isChecking: false })

    await loadEntryAndSetup()
    await nextTick()
    await flush()

    expect(useAgentConsent().withConsent).not.toHaveBeenCalled()
    expect(agentStore.open).not.toHaveBeenCalled()
    expect(consentStore.load).toHaveBeenCalledOnce()
  })

  it('offers in the same session once the Getting Started screen closes', async () => {
    setAgentReady(true)
    showFirstRunScreen()
    Object.assign(consentStore, { accepted: false, isChecking: false })

    await loadEntryAndSetup()
    await flush()
    expect(useAgentConsent().withConsent).not.toHaveBeenCalled()
    expect(await notOffered()).toHaveBeenCalledExactlyOnceWith({
      reason: 'first_run_screen'
    })

    releaseFirstRunScreen()
    await vi.waitFor(() =>
      expect(useAgentConsent().withConsent).toHaveBeenCalledOnce()
    )
  })

  it('keeps waiting when Getting Started closes straight into the first-run tour', async () => {
    setAgentReady(true)
    showFirstRunScreen()
    Object.assign(consentStore, { accepted: false, isChecking: false })

    await loadEntryAndSetup()
    await flush()

    beginFirstRunScreenHandoff()
    await flush()
    expect(useAgentConsent().withConsent).not.toHaveBeenCalled()

    activeTour.value = 'firstRun'
    releaseFirstRunScreen()
    await flush()
    expect(useAgentConsent().withConsent).not.toHaveBeenCalled()

    activeTour.value = null
    await vi.waitFor(() =>
      expect(useAgentConsent().withConsent).toHaveBeenCalledOnce()
    )
  })

  it('offers when neither Getting Started took the screen nor a tour is active', async () => {
    setAgentReady(true)
    Object.assign(consentStore, { accepted: false, isChecking: false })

    await loadEntryAndSetup()
    await vi.waitFor(() =>
      expect(useAgentConsent().withConsent).toHaveBeenCalledOnce()
    )

    expect(await notOffered()).not.toHaveBeenCalled()
  })

  it('waits for the startup decision before offering', async () => {
    setAgentReady(true)
    Object.assign(consentStore, { accepted: false, isChecking: false })
    let decide = (_: boolean) => {}
    startupDecision = new Promise<boolean>((resolve) => {
      decide = resolve
    })

    await loadEntryAndSetup()
    await nextTick()
    await flush()
    expect(useAgentConsent().withConsent).not.toHaveBeenCalled()

    decide(true)
    await vi.waitFor(() =>
      expect(useAgentConsent().withConsent).toHaveBeenCalledOnce()
    )
  })

  it('skips the automatic offer for the session when the boot never reports', async () => {
    setAgentReady(true)
    Object.assign(consentStore, { accepted: false, isChecking: false })
    startupDecision = Promise.resolve(false)

    await loadEntryAndSetup()
    await nextTick()
    await flush()

    expect(useAgentConsent().withConsent).not.toHaveBeenCalled()
    expect(consentStore.load).toHaveBeenCalledOnce()
  })

  it('offers once the tour that held it ends', async () => {
    setAgentReady(true)
    activeTour.value = 'appMode'
    Object.assign(consentStore, { accepted: false, isChecking: false })

    await loadEntryAndSetup()
    await nextTick()
    await flush()
    expect(useAgentConsent().withConsent).not.toHaveBeenCalled()

    activeTour.value = null
    await vi.waitFor(() =>
      expect(useAgentConsent().withConsent).toHaveBeenCalledOnce()
    )
  })

  it('waits for the startup decision before re-offering after a tour ends', async () => {
    setAgentReady(true)
    activeTour.value = 'appMode'
    Object.assign(consentStore, { accepted: false, isChecking: false })
    let decide = (_: boolean) => {}
    startupDecision = new Promise<boolean>((resolve) => {
      decide = resolve
    })

    await loadEntryAndSetup()
    await nextTick()
    await flush()
    activeTour.value = null
    await flush()
    expect(useAgentConsent().withConsent).not.toHaveBeenCalled()

    decide(true)
    await vi.waitFor(() =>
      expect(useAgentConsent().withConsent).toHaveBeenCalledOnce()
    )
  })

  it('does not re-offer while an offer is still in flight', async () => {
    setAgentReady(true)
    Object.assign(consentStore, { accepted: false, isChecking: false })
    let finish = () => {}
    const pending = new Promise<void>((resolve) => {
      finish = resolve
    })
    vi.mocked(useAgentConsent().withConsent).mockImplementationOnce(
      async () => {
        await pending
      }
    )

    await loadEntryAndSetup()
    await vi.waitFor(() =>
      expect(useAgentConsent().withConsent).toHaveBeenCalledOnce()
    )
    activeTour.value = 'appMode'
    await flush()
    activeTour.value = null
    await flush()

    expect(useAgentConsent().withConsent).toHaveBeenCalledOnce()
    finish()
    await flush()
  })

  it('withholds a card whose tour started while the offer was in flight, then re-offers', async () => {
    setAgentReady(true)
    Object.assign(consentStore, { accepted: false, isChecking: false })
    vi.mocked(useAgentConsent().withConsent).mockImplementationOnce(
      async (_trigger, _onAccept, hooks) => {
        activeTour.value = 'appMode'
        await flush()
        if (hooks?.canShow?.() === false) return
      }
    )

    await loadEntryAndSetup()
    await vi.waitFor(() =>
      expect(useAgentConsent().withConsent).toHaveBeenCalledOnce()
    )
    await flush()
    expect(agentStore.open).not.toHaveBeenCalled()

    activeTour.value = null
    await vi.waitFor(() =>
      expect(useAgentConsent().withConsent).toHaveBeenCalledTimes(2)
    )
    expect(agentStore.open).not.toHaveBeenCalled()
  })

  it('stays silent after a tour ends when the saved consent cannot be read', async () => {
    setAgentReady(true)
    activeTour.value = 'appMode'
    Object.assign(consentStore, { accepted: false, isChecking: false })
    vi.mocked(consentStore.load).mockRejectedValue(new Error('offline'))

    await loadEntryAndSetup()
    activeTour.value = null
    await flush()

    expect(useAgentConsent().withConsent).not.toHaveBeenCalled()
  })

  describe('reports why the automatic offer stayed silent', () => {
    it.for([
      {
        reason: 'first_run_screen',
        arrange: () => {
          showFirstRunScreen()
        }
      },
      {
        reason: 'tour_active',
        arrange: () => {
          activeTour.value = 'appMode'
        }
      },
      {
        reason: 'dialog_open',
        arrange: () => {
          openDialog()
        }
      },
      {
        reason: 'boot_undecided',
        arrange: () => {
          startupDecision = Promise.resolve(false)
        }
      }
    ] as const)(
      'reports $reason once however often the offer re-runs',
      async ({ reason, arrange }) => {
        setAgentReady(true)
        Object.assign(consentStore, { accepted: false, isChecking: false })
        arrange()

        await loadEntryAndSetup()
        await nextTick()
        await flush()

        setAgentReady(false)
        await nextTick()
        setAgentReady(true)
        await nextTick()
        await flush()

        expect(await notOffered()).toHaveBeenCalledExactlyOnceWith({ reason })
        expect(useAgentConsent().withConsent).not.toHaveBeenCalled()
      }
    )

    it.for([
      {
        name: 'the user accepted',
        change: () => {
          Object.assign(consentStore, { accepted: true })
        }
      },
      {
        name: 'the panel was switched off',
        change: async () => {
          setAgentReady(false)
          await nextTick()
        }
      },
      {
        name: 'consent is being checked again',
        change: () => {
          Object.assign(consentStore, { isChecking: true })
        }
      }
    ])(
      'stays quiet about an undecided boot when $name meanwhile',
      async ({ change }) => {
        setAgentReady(true)
        Object.assign(consentStore, { accepted: false, isChecking: false })
        let decide = (_: boolean) => {}
        startupDecision = new Promise<boolean>((resolve) => {
          decide = resolve
        })

        await loadEntryAndSetup()
        await flush()
        change()
        decide(false)
        await flush()

        expect(await notOffered()).not.toHaveBeenCalled()
      }
    )

    it('reports the first-run screen over a dialog sitting on top of it', async () => {
      setAgentReady(true)
      showFirstRunScreen()
      openDialog()
      Object.assign(consentStore, { accepted: false, isChecking: false })

      await loadEntryAndSetup()
      await nextTick()
      await flush()

      expect(await notOffered()).toHaveBeenCalledExactlyOnceWith({
        reason: 'first_run_screen'
      })
      expect(useAgentConsent().withConsent).not.toHaveBeenCalled()
    })

    it('reports nothing for an in-flight tour once the current scope has answered', async () => {
      setAgentReady(true)
      Object.assign(consentStore, { accepted: false, isChecking: false })
      localStorage.setItem(
        'Comfy.AgentConsent.IntroductionResponded.account-a.workspace-b',
        'true'
      )
      vi.mocked(useAgentConsent().withConsent).mockImplementationOnce(
        async (_trigger, _onAccept, hooks) => {
          Object.assign(workspaceStore, { activeWorkspaceId: 'workspace-b' })
          activeTour.value = 'appMode'
          await flush()
          hooks?.canShow?.()
        }
      )

      await loadEntryAndSetup()
      await vi.waitFor(() =>
        expect(useAgentConsent().withConsent).toHaveBeenCalledOnce()
      )
      await flush()

      expect(await notOffered()).not.toHaveBeenCalled()
    })

    it('reports a reason again for a second workspace', async () => {
      setAgentReady(true)
      activeTour.value = 'appMode'
      Object.assign(consentStore, { accepted: false, isChecking: false })

      await loadEntryAndSetup()
      await flush()
      Object.assign(workspaceStore, { activeWorkspaceId: 'workspace-b' })
      Object.assign(consentStore, { identity: 'account-a/workspace-b' })
      await flush()

      expect(await notOffered()).toHaveBeenCalledTimes(2)
      expect(await notOffered()).toHaveBeenLastCalledWith({
        reason: 'tour_active'
      })
    })

    it.for([
      {
        name: 'the account or workspace is still unknown',
        arrange: () => {
          Object.assign(workspaceStore, { activeWorkspaceId: null })
        }
      }
    ])('reports nothing for a held offer when $name', async ({ arrange }) => {
      setAgentReady(true)
      activeTour.value = 'appMode'
      Object.assign(consentStore, { accepted: false, isChecking: false })
      arrange()

      await loadEntryAndSetup()
      await nextTick()
      await flush()

      expect(await notOffered()).not.toHaveBeenCalled()
    })
  })

  describe('names the exit when the offer ends without naming a surface', () => {
    const rerunFlagGate = async (): Promise<void> => {
      setAgentReady(false)
      await nextTick()
      setAgentReady(true)
      await nextTick()
    }

    it.for([
      {
        exit: 'consent_unresolved',
        arrange: () => {
          Object.assign(consentStore, { isChecking: true })
        }
      },
      {
        exit: 'consent_already_accepted',
        arrange: () => {
          Object.assign(consentStore, { accepted: true })
        }
      }
    ] as const)(
      'reports $exit once however often the offer re-runs',
      async ({ exit, arrange }) => {
        setAgentReady(true)
        Object.assign(consentStore, { accepted: false, isChecking: false })
        arrange()

        await loadEntryAndSetup()
        await rerunFlagGate()
        await flush()

        expect(await offerExited()).toHaveBeenCalledExactlyOnceWith({
          exit,
          stage: 'offer',
          retry_armed: false
        })
        expect(useAgentConsent().withConsent).not.toHaveBeenCalled()
        expect(await notOffered()).not.toHaveBeenCalled()
      }
    )

    it('reports an offer refused because another attempt is still in flight', async () => {
      setAgentReady(true)
      Object.assign(consentStore, { accepted: false, isChecking: false })
      let finish = () => {}
      const pending = new Promise<void>((resolve) => {
        finish = resolve
      })
      vi.mocked(useAgentConsent().withConsent).mockImplementationOnce(
        async () => {
          await pending
        }
      )

      await loadEntryAndSetup()
      await vi.waitFor(() =>
        expect(useAgentConsent().withConsent).toHaveBeenCalledOnce()
      )
      await rerunFlagGate()
      await flush()

      expect(await offerExited()).toHaveBeenCalledExactlyOnceWith({
        exit: 'offer_in_flight',
        stage: 'offer',
        retry_armed: false
      })
      finish()
      await pending
    })

    it('reports an offer skipped because the card has already been on screen', async () => {
      setAgentReady(true)
      Object.assign(consentStore, { accepted: false, isChecking: false })

      await loadEntryAndSetup()
      openDialog(CONSENT_DIALOG_KEY)
      await flush()
      closeDialog(CONSENT_DIALOG_KEY)
      await rerunFlagGate()
      await flush()

      expect(await offerExited()).toHaveBeenCalledWith({
        exit: 'card_already_seen',
        stage: 'offer',
        retry_armed: false
      })
    })

    it.for([
      {
        exit: 'consent_already_accepted',
        stage: 'load',
        arrange: () => {
          vi.mocked(consentStore.load).mockResolvedValue(true)
        }
      },
      {
        exit: 'consent_read_failed',
        stage: 'load',
        arrange: () => {
          vi.mocked(consentStore.load).mockRejectedValue(new Error('offline'))
        }
      },
      {
        exit: 'startup_probe_failed',
        stage: 'startup',
        arrange: () => {
          const rejected = Promise.reject<boolean>(new Error('startup blew up'))
          // Marked handled here so the rejection is not unhandled during the
          // window before the extension attaches its own catch.
          rejected.catch(() => {})
          startupDecision = rejected
        }
      }
    ] as const)(
      'reports $exit at the $stage stage',
      async ({ exit, stage, arrange }) => {
        setAgentReady(true)
        Object.assign(consentStore, { accepted: false, isChecking: false })
        arrange()

        await loadEntryAndSetup()
        await flush()

        expect(await offerExited()).toHaveBeenCalledExactlyOnceWith({
          exit,
          stage,
          retry_armed: false
        })
      }
    )

    it('reports why an undecided boot was also ineligible', async () => {
      // `boot_undecided` is gated on eligibility, so this combination used to
      // forfeit the offer and report nothing at all.
      setAgentReady(true)
      Object.assign(consentStore, { accepted: false, isChecking: false })
      let decide = (_: boolean) => {}
      startupDecision = new Promise<boolean>((resolve) => {
        decide = resolve
      })

      await loadEntryAndSetup()
      await flush()
      Object.assign(consentStore, { isChecking: true })
      decide(false)
      await flush()

      expect(await notOffered()).not.toHaveBeenCalled()
      expect(await offerExited()).toHaveBeenCalledExactlyOnceWith({
        exit: 'consent_unresolved',
        stage: 'startup',
        retry_armed: false
      })
    })

    it('marks the exit that loses a held offer as still having a retry armed', async () => {
      // This is gc-17's silent loss, made visible: a dialog holds the offer,
      // the screen clears, and the retry's consent read fails. Before #18975
      // the offer was gone for the page load; after it the hold survives - and
      // either way the only telemetry was a first `dialog_open`, because the
      // reason is deduplicated per page load.
      setAgentReady(true)
      openDialog()
      Object.assign(consentStore, { accepted: false, isChecking: false })

      await loadEntryAndSetup()
      await flush()
      expect(await notOffered()).toHaveBeenCalledExactlyOnceWith({
        reason: 'dialog_open'
      })
      expect(await offerExited()).not.toHaveBeenCalled()

      vi.mocked(consentStore.load).mockRejectedValueOnce(new Error('offline'))
      closeDialog()
      await flush()
      await flush()

      expect(await notOffered()).toHaveBeenCalledOnce()
      expect(await offerExited()).toHaveBeenCalledExactlyOnceWith({
        exit: 'consent_read_failed',
        stage: 'load',
        retry_armed: true
      })
    })

    it('reports the same exit again when its retry state changes', async () => {
      setAgentReady(true)
      openDialog()
      Object.assign(consentStore, { accepted: false, isChecking: false })

      await loadEntryAndSetup()
      await flush()

      vi.mocked(consentStore.load).mockRejectedValueOnce(new Error('offline'))
      closeDialog()
      await flush()
      await flush()

      Object.assign(workspaceStore, { activeWorkspaceId: 'workspace-b' })
      Object.assign(consentStore, { identity: 'account-a/workspace-b' })
      await flush()
      await flush()

      vi.mocked(consentStore.load).mockRejectedValueOnce(new Error('offline'))
      Object.assign(workspaceStore, { activeWorkspaceId: 'workspace-c' })
      Object.assign(consentStore, { identity: 'account-a/workspace-c' })
      await flush()

      expect(await offerExited()).toHaveBeenCalledTimes(2)
      expect(await offerExited()).toHaveBeenNthCalledWith(1, {
        exit: 'consent_read_failed',
        stage: 'load',
        retry_armed: true
      })
      expect(await offerExited()).toHaveBeenNthCalledWith(2, {
        exit: 'consent_read_failed',
        stage: 'load',
        retry_armed: false
      })
    })

    it('reports nothing for an unflagged page load', async () => {
      // Not because the reporter is gated on the flag - it is not - but because
      // `loadConsentIfEligible` returns on an off flag before reaching any
      // reported exit. That is the whole mechanism keeping this event off the
      // population outside the rollout, so it is asserted rather than assumed.
      setAgentReady(false)
      Object.assign(consentStore, { accepted: false, isChecking: false })
      vi.mocked(consentStore.load).mockRejectedValue(new Error('offline'))

      await loadEntryAndSetup()
      await flush()

      expect(await offerExited()).not.toHaveBeenCalled()
      expect(consentStore.load).not.toHaveBeenCalled()
    })

    it('still reports why the offer ended when the flag goes off mid-flight', async () => {
      // The flag was on when the offer started, so this attempt is already
      // under way and its ending is real. A reporter gated on the current flag
      // value would hide exactly this case, which is why it is not.
      setAgentReady(true)
      Object.assign(consentStore, { accepted: false, isChecking: false })
      let fail = (_: Error) => {}
      vi.mocked(consentStore.load).mockReturnValueOnce(
        new Promise<boolean>((_, reject) => {
          fail = reject
        })
      )

      await loadEntryAndSetup()
      await vi.waitFor(() => expect(consentStore.load).toHaveBeenCalled())
      setAgentReady(false)
      await nextTick()
      await flush()
      fail(new Error('offline'))
      await flush()

      expect(agentStore.enabled).toBe(false)
      expect(await offerExited()).toHaveBeenCalledExactlyOnceWith({
        exit: 'consent_read_failed',
        stage: 'load',
        retry_armed: false
      })
    })
  })

  it('offers in the same session once the dialog that held it closes', async () => {
    setAgentReady(true)
    openDialog()
    Object.assign(consentStore, { accepted: false, isChecking: false })

    await loadEntryAndSetup()
    await nextTick()
    await flush()
    expect(useAgentConsent().withConsent).not.toHaveBeenCalled()

    closeDialog()
    await vi.waitFor(() =>
      expect(useAgentConsent().withConsent).toHaveBeenCalledOnce()
    )
  })

  it('keeps the held offer when the retry cannot be made, and offers on the next clear screen', async () => {
    setAgentReady(true)
    openDialog()
    Object.assign(consentStore, { accepted: false, isChecking: false })

    await loadEntryAndSetup()
    await flush()
    expect(await notOffered()).toHaveBeenCalledExactlyOnceWith({
      reason: 'dialog_open'
    })

    // The screen clears, but the retry's consent read fails - a cloud session
    // whose auth is still settling is the ordinary way that happens. The
    // release used to consume the hold before finding that out, which lost the
    // offer for the rest of the page load and emitted nothing to say so: the
    // reason is deduplicated per page load, so there is no second
    // `agent_consent_not_offered` either.
    vi.mocked(consentStore.load).mockRejectedValueOnce(new Error('offline'))
    closeDialog()
    await flush()
    await flush()
    expect(useAgentConsent().withConsent).not.toHaveBeenCalled()
    expect(await notOffered()).toHaveBeenCalledOnce()

    // A later dialog comes and goes and the read works this time. The offer is
    // still owed, so it lands.
    openDialog()
    await flush()
    closeDialog()
    await vi.waitFor(() =>
      expect(useAgentConsent().withConsent).toHaveBeenCalledOnce()
    )
  })

  it('keeps waiting when a tour ends while a dialog is still open', async () => {
    setAgentReady(true)
    activeTour.value = 'appMode'
    openDialog()
    Object.assign(consentStore, { accepted: false, isChecking: false })

    await loadEntryAndSetup()
    await nextTick()
    await flush()
    activeTour.value = null
    await flush()
    expect(useAgentConsent().withConsent).not.toHaveBeenCalled()

    closeDialog()
    await vi.waitFor(() =>
      expect(useAgentConsent().withConsent).toHaveBeenCalledOnce()
    )
  })

  it('withholds a card whose dialog opened while the offer was in flight, then re-offers', async () => {
    setAgentReady(true)
    Object.assign(consentStore, { accepted: false, isChecking: false })
    vi.mocked(useAgentConsent().withConsent).mockImplementationOnce(
      async (_trigger, _onAccept, hooks) => {
        openDialog()
        await flush()
        if (hooks?.canShow?.() === false) return
      }
    )

    await loadEntryAndSetup()
    await vi.waitFor(() =>
      expect(useAgentConsent().withConsent).toHaveBeenCalledOnce()
    )
    await flush()
    expect(agentStore.open).not.toHaveBeenCalled()

    closeDialog()
    await vi.waitFor(() =>
      expect(useAgentConsent().withConsent).toHaveBeenCalledTimes(2)
    )
  })

  it('re-offers after a withheld in-flight offer settles on a clear screen', async () => {
    setAgentReady(true)
    Object.assign(consentStore, { accepted: false, isChecking: false })
    let settleOffer = () => {}
    const pendingOffer = new Promise<void>((resolve) => {
      settleOffer = resolve
    })
    vi.mocked(useAgentConsent().withConsent).mockImplementationOnce(
      async (_trigger, _onAccept, hooks) => {
        openDialog()
        await flush()
        if (hooks?.canShow?.() === false) await pendingOffer
      }
    )

    await loadEntryAndSetup()
    await vi.waitFor(() =>
      expect(useAgentConsent().withConsent).toHaveBeenCalledOnce()
    )

    closeDialog()
    await vi.waitFor(() =>
      expect(useAgentConsent().withConsent).toHaveBeenCalledOnce()
    )
    settleOffer()

    await vi.waitFor(() =>
      expect(useAgentConsent().withConsent).toHaveBeenCalledTimes(2)
    )
  })

  it('does not re-offer after the user declines a manually opened card', async () => {
    setAgentReady(true)
    Object.assign(consentStore, { accepted: false, isChecking: false })
    let decide = (_: boolean) => {}
    startupDecision = new Promise<boolean>((resolve) => {
      decide = resolve
    })

    await loadEntryAndSetup()
    openDialog(CONSENT_DIALOG_KEY)
    await flush()
    decide(true)
    await flush()
    closeDialog(CONSENT_DIALOG_KEY)
    await flush()

    expect(useAgentConsent().withConsent).not.toHaveBeenCalled()
  })

  it('skips the automatic offer for the session once the user has seen the card', async () => {
    setAgentReady(true)
    Object.assign(consentStore, { accepted: false, isChecking: false })
    let decide = (_: boolean) => {}
    startupDecision = new Promise<boolean>((resolve) => {
      decide = resolve
    })

    await loadEntryAndSetup()
    openDialog(CONSENT_DIALOG_KEY)
    await flush()
    closeDialog(CONSENT_DIALOG_KEY)
    decide(true)
    await flush()

    expect(useAgentConsent().withConsent).not.toHaveBeenCalled()
  })

  it('remembers a seen card per workspace across a switch away and back', async () => {
    setAgentReady(true)
    Object.assign(consentStore, { accepted: false, isChecking: false })
    let decide = (_: boolean) => {}
    startupDecision = new Promise<boolean>((resolve) => {
      decide = resolve
    })

    await loadEntryAndSetup()
    openDialog(CONSENT_DIALOG_KEY)
    await flush()
    closeDialog(CONSENT_DIALOG_KEY)
    decide(true)
    await flush()

    Object.assign(workspaceStore, { activeWorkspaceId: 'workspace-b' })
    Object.assign(consentStore, { identity: 'account-a/workspace-b/1' })
    await vi.waitFor(() =>
      expect(useAgentConsent().withConsent).toHaveBeenCalledOnce()
    )

    Object.assign(workspaceStore, { activeWorkspaceId: 'workspace-a' })
    Object.assign(consentStore, { identity: 'account-a/workspace-a/2' })
    await flush()
    await flush()

    expect(useAgentConsent().withConsent).toHaveBeenCalledOnce()
  })

  it('does not re-read consent on every dialog close while the read keeps failing', async () => {
    setAgentReady(true)
    Object.assign(consentStore, { accepted: false, isChecking: false })
    vi.mocked(consentStore.load).mockRejectedValue(new Error('offline'))

    await loadEntryAndSetup()
    await flush()
    const loadsAfterBoot = vi.mocked(consentStore.load).mock.calls.length
    for (let cycle = 0; cycle < 3; cycle++) {
      openDialog()
      await flush()
      closeDialog()
      await flush()
    }

    expect(consentStore.load).toHaveBeenCalledTimes(loadsAfterBoot)
  })

  it('stays silent when the account already accepted', async () => {
    setAgentReady(true)
    Object.assign(consentStore, { accepted: true, isChecking: false })
    vi.mocked(consentStore.load).mockResolvedValue(true)

    await loadEntryAndSetup()
    await flush()

    expect(useAgentConsent().withConsent).not.toHaveBeenCalled()
  })

  it.for([
    {
      outcome: 'succeeds',
      load: () => Promise.resolve(false),
      offers: 2
    },
    {
      outcome: 'fails',
      load: () => Promise.reject(new Error('offline')),
      offers: 1
    }
  ])(
    'rechecks a missed account change once when the next consent load $outcome',
    async ({ load, offers }) => {
      setAgentReady(true)
      Object.assign(consentStore, { accepted: false, isChecking: false })
      let finish = () => {}
      const pending = new Promise<void>((resolve) => {
        finish = resolve
      })
      vi.mocked(useAgentConsent().withConsent).mockReturnValueOnce(pending)

      await loadEntryAndSetup()
      await vi.waitFor(() =>
        expect(useAgentConsent().withConsent).toHaveBeenCalledOnce()
      )
      vi.mocked(consentStore.load).mockClear()
      currentUser.value = { id: 'account-b' }
      Object.assign(consentStore, { identity: 'account-b/workspace-a' })
      await vi.waitFor(() => expect(consentStore.load).toHaveBeenCalledOnce())
      expect(useAgentConsent().withConsent).toHaveBeenCalledOnce()

      vi.mocked(consentStore.load).mockImplementation(load)
      finish()
      await vi.waitFor(() => expect(consentStore.load).toHaveBeenCalledTimes(2))

      expect(useAgentConsent().withConsent).toHaveBeenCalledTimes(offers)
    }
  )

  it.for([
    { userId: 'account-b', workspaceId: 'workspace-a' },
    { userId: 'account-a', workspaceId: 'workspace-b' }
  ])(
    'offers independently for $userId / $workspaceId',
    async ({ userId, workspaceId }) => {
      setAgentReady(true)
      Object.assign(consentStore, { accepted: false, isChecking: false })
      vi.mocked(useAgentConsent().withConsent).mockImplementationOnce(
        async () => {
          openDialog(CONSENT_DIALOG_KEY)
          await flush()
          closeDialog(CONSENT_DIALOG_KEY)
        }
      )

      await loadEntryAndSetup()
      await flush()
      expect(useAgentConsent().withConsent).toHaveBeenCalledOnce()

      currentUser.value = { id: userId }
      Object.assign(workspaceStore, { activeWorkspaceId: workspaceId })
      Object.assign(consentStore, { identity: `${userId}/${workspaceId}` })
      await vi.waitFor(() =>
        expect(useAgentConsent().withConsent).toHaveBeenCalledTimes(2)
      )

      currentUser.value = { id: 'account-a' }
      Object.assign(workspaceStore, { activeWorkspaceId: 'workspace-a' })
      Object.assign(consentStore, { identity: 'account-a/workspace-a' })
      await flush()

      expect(useAgentConsent().withConsent).toHaveBeenCalledTimes(2)
    }
  )

  it('withholds the automatic card when storage cannot be written', async () => {
    setAgentReady(true)
    Object.assign(consentStore, { accepted: false, isChecking: false })
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('Storage unavailable')
    })

    await loadEntryAndSetup()
    await flush()

    expect(useAgentConsent().withConsent).not.toHaveBeenCalled()
    expect(await notOffered()).toHaveBeenCalledExactlyOnceWith({
      reason: 'storage_unavailable'
    })
  })

  it('withholds the automatic card when storage cannot fit the introduction response', async () => {
    const entryLength =
      'Comfy.AgentConsent.IntroductionResponded.account-a.workspace-a'.length +
      'true'.length
    setAgentReady(true)
    Object.assign(consentStore, { accepted: false, isChecking: false })
    const setItem = localStorage.setItem.bind(localStorage)
    vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
      if (key.length + value.length >= entryLength)
        throw new DOMException('Quota exceeded', 'QuotaExceededError')
      setItem(key, value)
    })

    await loadEntryAndSetup()
    await flush()

    expect(useAgentConsent().withConsent).not.toHaveBeenCalled()
    expect(await notOffered()).toHaveBeenCalledExactlyOnceWith({
      reason: 'storage_unavailable'
    })
  })

  it('stays silent for an answered scope when storage cannot be written', async () => {
    setAgentReady(true)
    Object.assign(consentStore, { accepted: false, isChecking: false })
    localStorage.setItem(
      'Comfy.AgentConsent.IntroductionResponded.account-a.workspace-a',
      'true'
    )
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('Storage unavailable')
    })

    await loadEntryAndSetup()
    await flush()

    expect(useAgentConsent().withConsent).not.toHaveBeenCalled()
    expect(await notOffered()).not.toHaveBeenCalled()
  })

  it('reports the finished launch window, not a storage failure, when writes fail after it', async () => {
    setAgentReady(true)
    Object.assign(consentStore, { accepted: false, isChecking: false })
    localStorage.setItem(ACTIVATION_VISITS_STORAGE_KEY, '2')
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('Storage unavailable')
    })

    await loadEntryAndSetup()
    await flush()

    expect(useAgentConsent().withConsent).not.toHaveBeenCalled()
    expect(await notOffered()).not.toHaveBeenCalled()
    expect(await offerExited()).toHaveBeenCalledWith({
      exit: 'activation_window_complete',
      stage: 'startup',
      retry_armed: false
    })
  })

  it('treats unreadable storage as past the automatic launches', async () => {
    setAgentReady(true)
    Object.assign(consentStore, { accepted: false, isChecking: false })
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new Error('Storage unavailable')
    })

    await loadEntryAndSetup()
    await flush()

    expect(useAgentConsent().withConsent).not.toHaveBeenCalled()
    expect(await offerExited()).toHaveBeenCalledWith({
      exit: 'activation_window_complete',
      stage: 'startup',
      retry_armed: false
    })
  })

  it('stays silent when the saved consent cannot be read', async () => {
    setAgentReady(true)
    Object.assign(consentStore, { accepted: false, isChecking: false })
    vi.mocked(consentStore.load).mockRejectedValue(new Error('offline'))

    await loadEntryAndSetup()
    await flush()

    expect(useAgentConsent().withConsent).not.toHaveBeenCalled()
    expect(await notOffered()).not.toHaveBeenCalled()
  })

  it('forces the panel on in development even while the flag is false', async () => {
    vi.stubEnv('MODE', 'development')
    vi.stubEnv('VITE_AGENT_STANDALONE', 'true')
    setAgentReady(false)

    await loadEntryAndSetup()

    expect(agentStore.enabled).toBe(true)
    expect(consentStore.load).toHaveBeenCalledOnce()
  })

  it("leaves a development build off cloud to ComfyUI's agent", async () => {
    vi.stubEnv('MODE', 'development')
    vi.stubEnv('VITE_AGENT_STANDALONE', '')
    Object.assign(agentStore, { flagsSettled: false })

    await loadEntryAndSetup()

    expect(agentStore.enabled).toBe(false)
    expect(agentStore.gateSettled).toBe(false)
  })

  it('enables the panel once ComfyUI reports its agent ready', async () => {
    Object.assign(agentStore, {
      comfyAgent: { state: 'starting', reason: null }
    })

    await loadEntryAndSetup()
    expect(agentStore.enabled).toBe(false)

    Object.assign(agentStore, {
      comfyAgent: { state: 'ready', reason: null }
    })
    await nextTick()
    expect(agentStore.enabled).toBe(true)

    Object.assign(agentStore, {
      comfyAgent: { state: 'failed', reason: 'unknown' }
    })
    await nextTick()
    expect(agentStore.enabled).toBe(false)
  })

  it('leaves the panel disabled while the flag is undefined', async () => {
    await loadEntryAndSetup()
    expect(agentStore.enabled).toBe(false)
    expect(consentStore.load).not.toHaveBeenCalled()
  })

  it('registers the tab-activity tracker once at setup, not gated on the flag', async () => {
    await loadEntryAndSetup()
    expect(registerWorkflowTabActivityTracker).toHaveBeenCalledTimes(1)
  })

  it('projects consent into the panel visibility gate', async () => {
    await loadEntryAndSetup()
    expect(agentStore.consentAccepted).toBe(true)
  })

  it('reloads consent when the resolved account changes', async () => {
    setAgentReady(true)
    await loadEntryAndSetup()
    expect(consentStore.load).toHaveBeenCalledOnce()
    currentUser.value = { id: 'account-b' }
    await flush()
    expect(consentStore.load).toHaveBeenCalledTimes(2)
  })

  it('reloads consent when the same user changes workspace scope', async () => {
    setAgentReady(true)
    await loadEntryAndSetup()
    expect(consentStore.load).toHaveBeenCalledOnce()
    Object.assign(consentStore, { identity: 'account-a/workspace-b' })
    await flush()
    expect(consentStore.load).toHaveBeenCalledTimes(2)
  })

  it('stops node picking before a graph load regardless of consent', async () => {
    const { registerAgentPanelExtension } = await import('./agentPanel')
    registerAgentPanelExtension()
    const extension = mocks.capturedExtensions.find(
      (item) => item.name === 'Comfy.AgentPanel'
    )
    const canvasStore = useCanvasStore()
    canvasStore.isPickingNodes = true

    await extension!.beforeLoadGraph!({} as never)

    expect(canvasStore.isPickingNodes).toBe(false)
  })

  it('enables the panel when the flag turns true', async () => {
    await loadEntryAndSetup()
    setAgentReady(true)
    await nextTick()
    expect(agentStore.enabled).toBe(true)
  })

  it('settles the gate once the server feature flags land', async () => {
    Object.assign(agentStore, { flagsSettled: false })
    await loadEntryAndSetup()
    expect(agentStore.gateSettled).toBe(false)

    Object.assign(agentStore, { flagsSettled: true })
    await nextTick()

    expect(agentStore.gateSettled).toBe(true)
  })

  it('retries consent after a fresh feature push with the same agent state', async () => {
    setAgentReady(true)
    Object.assign(consentStore, { accepted: false, isChecking: false })
    await loadEntryAndSetup()
    vi.mocked(consentStore.load).mockClear()

    setAgentReady(true)
    await nextTick()

    expect(consentStore.load).toHaveBeenCalledOnce()
  })

  it('disables the panel without closing it when the flag flips back to false', async () => {
    await loadEntryAndSetup()
    setAgentReady(true)
    await nextTick()
    setAgentReady(false)
    await nextTick()

    expect(agentStore.enabled).toBe(false)
    expect(agentStore.close).not.toHaveBeenCalled()
    expect(agentStore.isOpen).toBe(true)
  })

  it('stops node picking when the flag is disabled', async () => {
    await loadEntryAndSetup()
    setAgentReady(true)
    await nextTick()
    const canvasStore = useCanvasStore()
    canvasStore.isPickingNodes = true

    setAgentReady(false)
    await nextTick()

    expect(canvasStore.isPickingNodes).toBe(false)
  })

  it('revalidates root and subgraph references while the panel is closed without changing canvas selection', async () => {
    const { registerAgentPanelExtension } = await import('./agentPanel')
    registerAgentPanelExtension()
    const extension = mocks.capturedExtensions.find(
      (item) => item.name === 'Comfy.AgentPanel'
    )
    const rootGraph = new LGraph()
    const rootNode = new LGraphNode('Renamed root')
    rootNode.id = toNodeId('shared')
    rootGraph.add(rootNode)
    const subgraph = createTestSubgraph({
      id: '12345678-1234-1234-1234-123456789abc'
    })
    const subgraphNode = new LGraphNode('Renamed subgraph')
    subgraphNode.id = toNodeId('shared')
    subgraph.add(subgraphNode)
    rootGraph.subgraphs.set(subgraph.id, subgraph)
    const composer = useAgentComposerStore()
    const workflow = workflowStore.activeWorkflow
    if (!workflow) throw new Error('expected an active workflow')
    composer.setNodeScope(workflow.instanceId)
    composer.setNodes([
      { id: 'shared', title: 'Old root' },
      {
        id: 'shared',
        locatorId: createNodeLocatorId(subgraph.id, subgraphNode.id),
        title: 'Old subgraph'
      },
      { id: 'missing', title: 'Missing' }
    ])
    agentStore.isOpen = false
    const canvasStore = useCanvasStore()
    canvasStore.isPickingNodes = false
    const canvas = createTestCanvas(
      rootGraph,
      createMockCanvasRenderingContext2D()
    )
    onTestFinished(() => canvas.unbindEvents())
    canvasStore.canvas = canvas
    canvas.select(rootNode)

    await extension!.afterLoadGraph!(fromPartial({ rootGraph, canvas }))

    expect(composer.nodes).toEqual([
      { id: 'shared', title: 'Renamed root' },
      {
        id: 'shared',
        locatorId: '12345678-1234-1234-1234-123456789abc:shared',
        title: 'Renamed subgraph'
      }
    ])
    expect([...canvas.selectedItems]).toEqual([rootNode])
    expect(canvasStore.isPickingNodes).toBe(false)
  })

  it('does not revalidate references for another workflow instance', async () => {
    const { registerAgentPanelExtension } = await import('./agentPanel')
    registerAgentPanelExtension()
    const extension = mocks.capturedExtensions.find(
      (item) => item.name === 'Comfy.AgentPanel'
    )
    const composer = useAgentComposerStore()
    composer.setNodeScope('another-workflow-instance')
    composer.setNodes([{ id: '12', title: 'Original title' }])
    const graph = new LGraph()
    const node = new LGraphNode('Replacement title')
    node.id = toNodeId(12)
    graph.add(node)

    await extension!.afterLoadGraph!(fromPartial({ rootGraph: graph }))

    expect(composer.nodes).toEqual([{ id: '12', title: 'Original title' }])
  })

  describe('an accept the sign-in reload interrupted', () => {
    const PENDING_KEY = 'Comfy.AgentPanel.PendingSignInAccept'
    const resume = () => vi.mocked(useAgentConsent().resumeAcceptAfterReload)
    const storePending = (savedAt = Date.now()) =>
      sessionStorage.setItem(
        PENDING_KEY,
        JSON.stringify({ draft: 'make it blue', savedAt })
      )

    beforeEach(() => {
      sessionStorage.clear()
      storePending()
      setAgentReady(true)
    })

    afterEach(() => {
      useAgentConsentIntroductionStore().isContinuingSignIn = false
      sessionStorage.removeItem(PENDING_KEY)
    })

    it('is finished before consent is read', async () => {
      let finishResume = () => {}
      resume().mockImplementationOnce(
        () => new Promise<void>((resolve) => (finishResume = resolve))
      )

      await loadEntryAndSetup()
      Object.assign(consentStore, { identity: 'account-a/workspace-b' })
      await nextTick()
      expect(resume()).toHaveBeenCalledExactlyOnceWith('make it blue')
      expect(sessionStorage.getItem(PENDING_KEY)).toBeNull()
      expect(consentStore.load).not.toHaveBeenCalled()

      finishResume()
      await vi.waitFor(() => expect(consentStore.load).toHaveBeenCalledOnce())
      expect(resume()).toHaveBeenCalledOnce()
    })

    it('is resumed before the Agent is ready', async () => {
      setAgentReady(false)

      await loadEntryAndSetup()

      expect(resume()).toHaveBeenCalledOnce()
    })

    it('is dropped on sign-out before the Agent is ready', async () => {
      setAgentReady(false)
      currentUser.value = null

      await loadEntryAndSetup()

      expect(resume()).not.toHaveBeenCalled()
      expect(sessionStorage.getItem(PENDING_KEY)).toBeNull()
    })

    it('waits for the signed-in account to resolve', async () => {
      vi.mocked(useCurrentUser()).isLoggedIn = computed(() => true)
      currentUser.value = null

      await loadEntryAndSetup()

      expect(resume()).not.toHaveBeenCalled()
      expect(sessionStorage.getItem(PENDING_KEY)).not.toBeNull()

      currentUser.value = { id: 'account-a' }
      await nextTick()

      expect(resume()).toHaveBeenCalledOnce()
    })

    it('waits for a workspace switch to finish', async () => {
      Object.assign(workspaceStore, { isSwitching: true })
      Object.assign(consentStore, { identity: null })

      await loadEntryAndSetup()

      expect(resume()).not.toHaveBeenCalled()
      expect(consentStore.load).not.toHaveBeenCalled()
      expect(sessionStorage.getItem(PENDING_KEY)).not.toBeNull()

      Object.assign(workspaceStore, { isSwitching: false })
      Object.assign(consentStore, { identity: 'account-a/workspace-a' })
      await nextTick()

      expect(resume()).toHaveBeenCalledOnce()
    })

    it('is kept while auth has not settled on signed out', async () => {
      currentUser.value = null
      isAuthInitialized.value = false

      await loadEntryAndSetup()

      expect(resume()).not.toHaveBeenCalled()
      expect(sessionStorage.getItem(PENDING_KEY)).not.toBeNull()
    })

    it('is only looked at when the page starts, so one written in this page waits for the reload', async () => {
      currentUser.value = null
      await loadEntryAndSetup()
      expect(sessionStorage.getItem(PENDING_KEY)).toBeNull()

      storePending()
      currentUser.value = { id: 'account-a' }
      await nextTick()
      Object.assign(consentStore, { identity: 'account-a/workspace-b' })
      await nextTick()

      expect(resume()).not.toHaveBeenCalled()
      expect(sessionStorage.getItem(PENDING_KEY)).not.toBeNull()
    })

    it('drops it when another account takes over during the switch wait, through the real resume', async () => {
      resume().mockImplementation(realResumeAcceptAfterReload)
      vi.mocked(consentStore.ensureScope).mockResolvedValue(
        'account-b/workspace-a'
      )
      vi.mocked(consentStore.accept).mockResolvedValue(true)
      Object.assign(workspaceStore, { isSwitching: true })
      Object.assign(consentStore, { identity: null })

      await loadEntryAndSetup()
      currentUser.value = { id: 'account-b' }
      await nextTick()
      Object.assign(workspaceStore, { isSwitching: false })
      Object.assign(consentStore, { identity: 'account-b/workspace-a' })
      await nextTick()
      await vi.waitFor(() => expect(consentStore.load).toHaveBeenCalled())

      expect(resume()).not.toHaveBeenCalled()
      expect(consentStore.accept).not.toHaveBeenCalled()
      expect(sessionStorage.getItem(PENDING_KEY)).toBeNull()
    })

    it('ignores and drops one older than ten minutes', async () => {
      storePending(Date.now() - 11 * 60 * 1000)

      await loadEntryAndSetup()

      expect(resume()).not.toHaveBeenCalled()
      expect(sessionStorage.getItem(PENDING_KEY)).toBeNull()
    })
  })

  it('does not self-register when its module is imported', () => {
    expect(importRegistrationCount).toBe(0)
  })

  it('registers on a later call after a failed registration', () => {
    expect(failedRegistrationError).toBeInstanceOf(Error)
    expect(registrationsAfterRetry).toBe(1)
  })
})
