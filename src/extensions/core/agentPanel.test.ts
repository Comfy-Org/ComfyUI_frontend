import { fromPartial } from '@total-typescript/shoehorn'
vi.mock(import('firebase/auth'))
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mocked } from 'vitest'
import {
  computed,
  defineComponent,
  effectScope,
  nextTick,
  reactive,
  ref
} from 'vue'
import type { EffectScope } from 'vue'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'
let setupScope: EffectScope
import { useAgentConsentStore } from '@/workbench/extensions/agent/stores/agent/agentConsentStore'
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
import { useTelemetry } from '@/platform/telemetry'
import type { AgentConsentTrigger } from '@/platform/telemetry/types'
import type { useExtensionService } from '@/services/extensionService'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { createTestSubgraph } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useAgentNodeSelectionStore } from '@/stores/agentNodeSelectionStore'
import { useDialogStore } from '@/stores/dialogStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import type { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'
import { createMockLoadedWorkflow } from '@/utils/__tests__/litegraphTestUtils'
import { isLGraphNode } from '@/utils/litegraphUtil'
import { toNodeId } from '@/types/nodeId'

let agentStore: Mocked<ReturnType<typeof useAgentPanelStore>>
let nodeSelectionStore: Mocked<ReturnType<typeof useAgentNodeSelectionStore>>
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

vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: vi.fn()
}))
vi.mock(import('@/platform/telemetry'))

vi.mock(
  import('@/workbench/extensions/agent/composables/agent/useAgentConsent'),
  () => {
    const consent = fromPartial<ReturnType<typeof useAgentConsent>>({
      withConsent: vi.fn(
        async (
          _trigger: AgentConsentTrigger,
          onAccept: () => void,
          hooks?: ConsentOfferHooks
        ) => {
          if (hooks?.canShow?.() === false) return
          hooks?.onShown?.()
          onAccept()
        }
      )
    })
    const CONSENT_DIALOG_KEY = 'agent-consent' as const
    return { CONSENT_DIALOG_KEY, useAgentConsent: () => consent }
  }
)

const mocks = vi.hoisted(() => ({
  capturedExtensions: [] as ComfyExtension[]
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

vi.mock(import('@/services/extensionService'), () => ({
  useExtensionService: () =>
    fromPartial<ReturnType<typeof useExtensionService>>({
      registerExtension: (ext: ComfyExtension) => {
        mocks.capturedExtensions.push(ext)
      }
    })
}))

vi.mock(import('@/utils/litegraphUtil'), { spy: true })
vi.mock(import('@/utils/graphTraversalUtil'), { spy: true })

vi.mock(
  import('@/workbench/extensions/agent/services/agent/workflowTabActivityTracker'),
  () => ({
    registerWorkflowTabActivityTracker: vi.fn(() => () => {})
  })
)

const agentFlagEnabled = ref(false)

vi.mock(import('@/composables/useFeatureFlags'), () => ({
  useFeatureFlags: () =>
    fromPartial<ReturnType<typeof useFeatureFlags>>({
      flags: reactive({
        get agentInAppExperienceEnabled() {
          return agentFlagEnabled.value
        }
      })
    })
}))

const { registerAgentPanelExtension } = await import('./agentPanel')
const importRegistrationCount = mocks.capturedExtensions.length
registerAgentPanelExtension()

const flush = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 0))

const notOffered = async () =>
  vi.mocked(
    (await import('@/platform/telemetry')).useTelemetry()!
      .trackAgentConsentNotOffered
  )

const offerExited = async () =>
  vi.mocked(
    (await import('@/platform/telemetry')).useTelemetry()!
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

async function setRemoteConfigState(
  state: 'unloaded' | 'loading' | 'authenticated' | 'error'
): Promise<void> {
  const { authenticatedRemoteConfigState } =
    await import('@/platform/remoteConfig/remoteConfig')
  authenticatedRemoteConfigState.value = state
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
  afterEach(() => setupScope.stop())

  beforeEach(() => {
    const currentUserService = vi.mocked(useCurrentUser())
    currentUserService.resolvedUserInfo = computed(() => currentUser.value)
    currentUserService.isAuthInitialized = computed(
      () => isAuthInitialized.value
    )
    currentUserService.isLoggedIn = computed(() => currentUser.value !== null)
    setupScope = effectScope()
    currentUser.value = { id: 'account-a' }
    isAuthInitialized.value = true
    consentStore = useAgentConsentStore()
    workspaceStore = useTeamWorkspaceStore()
    Object.assign(workspaceStore, {
      activeWorkspaceId: 'workspace-a',
      isSwitching: false
    })
    Object.assign(consentStore, { accepted: true })
    Object.assign(consentStore, { identity: 'account-a/workspace-a' })
    vi.mocked(consentStore.load).mockResolvedValue(false)
    vi.mocked(isLGraphNode).mockImplementation(
      (node: unknown): node is LGraphNode =>
        typeof node === 'object' && node !== null && 'id' in node
    )
    agentStore = vi.mocked(useAgentPanelStore())
    agentStore.consentAccepted = false
    nodeSelectionStore = vi.mocked(useAgentNodeSelectionStore())
    workflowStore = useWorkflowStore()
    nodeSelectionStore.restoreNodeIds.mockImplementation(() => {})
    agentStore.close.mockClear()
    agentStore.enabled = false
    agentStore.isOpen = true
    agentFlagEnabled.value = false
    releaseFirstRunScreen()
    activeTour.value = null
    startupDecision = Promise.resolve(true)
    vi.spyOn(useOnboardingTourStore(), 'activeTour', 'get').mockImplementation(
      () => activeTour.value
    )
    localStorage.clear()
    nodeSelectionStore.beginWorkflowLoad.mockClear()
    nodeSelectionStore.finishWorkflowLoad.mockClear()
    nodeSelectionStore.nodeIds.mockReset()
    nodeSelectionStore.nodeIds.mockReturnValue([])
    nodeSelectionStore.restoreNodeIds.mockClear()
    nodeSelectionStore.saveNodeIds.mockClear()
    nodeSelectionStore.isLoadingWorkflow = false
    workflowStore.activeWorkflow = createMockLoadedWorkflow({
      path: 'workflows/first.json'
    })
  })

  it('attributes automatic acceptance with a restored open preference to the consent card', async () => {
    agentFlagEnabled.value = true
    Object.assign(consentStore, { accepted: false, isChecking: false })
    vi.mocked(useAgentConsent().withConsent).mockImplementationOnce(
      async (_trigger, onAccept, hooks) => {
        hooks?.onShown?.()
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
    agentFlagEnabled.value = true
    currentUser.value = user
    Object.assign(consentStore, { accepted: false, isChecking: false })
    agentStore.isOpen = false

    await loadEntryAndSetup()
    await vi.waitFor(() =>
      expect(agentStore.open).toHaveBeenCalledWith('activation')
    )

    expect(agentStore.isVisible).toBe(true)
  })

  it('waits for the general onboarding decision before activation', async () => {
    agentFlagEnabled.value = true
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

  it('does not reopen a dismissed activation panel after flag synchronization', async () => {
    agentFlagEnabled.value = true
    agentStore.isOpen = false

    await loadEntryAndSetup()
    await vi.waitFor(() =>
      expect(agentStore.open).toHaveBeenCalledExactlyOnceWith('activation')
    )

    agentStore.close('close_button')
    agentFlagEnabled.value = false
    await nextTick()
    agentFlagEnabled.value = true
    await flush()

    expect(agentStore.isOpen).toBe(false)
    expect(agentStore.open).toHaveBeenCalledOnce()
  })

  it('keeps the panel closed if the feature is disabled before acceptance', async () => {
    agentFlagEnabled.value = true
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
    agentFlagEnabled.value = false
    await nextTick()
    accept()
    finish()
    await pending

    expect(agentStore.open).not.toHaveBeenCalled()
  })

  it('records the automatic offer only after the card is displayed', async () => {
    agentFlagEnabled.value = true
    Object.assign(consentStore, { accepted: false, isChecking: false })
    const key = 'Comfy.AgentConsent.AutoShown.account-a.workspace-a'
    let show = () => {}
    let finish = () => {}
    const pending = new Promise<void>((resolve) => {
      finish = resolve
    })
    vi.mocked(useAgentConsent().withConsent).mockImplementationOnce(
      async (_trigger, _onAccept, hooks) => {
        show = hooks?.onShown ?? show
        await pending
      }
    )

    await loadEntryAndSetup()
    await vi.waitFor(() =>
      expect(useAgentConsent().withConsent).toHaveBeenCalledOnce()
    )
    expect(localStorage.getItem(key)).not.toBe('true')
    await nextTick()
    await flush()
    expect(useAgentConsent().withConsent).toHaveBeenCalledOnce()

    show()
    expect(localStorage.getItem(key)).toBe('true')
    finish()
    await pending
  })

  it('offers once the gate flips on after starting off', async () => {
    Object.assign(consentStore, { accepted: false, isChecking: false })

    await loadEntryAndSetup()
    expect(useAgentConsent().withConsent).not.toHaveBeenCalled()

    agentFlagEnabled.value = true
    await nextTick()

    await vi.waitFor(() =>
      expect(useAgentConsent().withConsent).toHaveBeenCalledOnce()
    )
    expect(agentStore.open).not.toHaveBeenCalled()
  })

  const AUTO_SHOWN_KEY = 'Comfy.AgentConsent.AutoShown.account-a.workspace-a'

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
  ])(
    'withholds the automatic offer while $surface, leaving the auto-shown key untouched',
    async ({ arrange }) => {
      agentFlagEnabled.value = true
      arrange()
      Object.assign(consentStore, { accepted: false, isChecking: false })

      await loadEntryAndSetup()
      await nextTick()
      await flush()

      expect(useAgentConsent().withConsent).not.toHaveBeenCalled()
      expect(localStorage.getItem(AUTO_SHOWN_KEY)).toBeNull()
      expect(agentStore.open).not.toHaveBeenCalled()
      expect(consentStore.load).toHaveBeenCalledOnce()
    }
  )

  it('offers in the same session once the Getting Started screen closes', async () => {
    agentFlagEnabled.value = true
    showFirstRunScreen()
    Object.assign(consentStore, { accepted: false, isChecking: false })

    await loadEntryAndSetup()
    await flush()
    expect(useAgentConsent().withConsent).not.toHaveBeenCalled()
    expect(await notOffered()).toHaveBeenCalledExactlyOnceWith({
      reason: 'first_run_screen'
    })
    expect(localStorage.getItem(AUTO_SHOWN_KEY)).toBeNull()

    releaseFirstRunScreen()
    await vi.waitFor(() =>
      expect(useAgentConsent().withConsent).toHaveBeenCalledOnce()
    )
    expect(localStorage.getItem(AUTO_SHOWN_KEY)).toBe('true')
  })

  it('keeps waiting when Getting Started closes straight into the first-run tour', async () => {
    agentFlagEnabled.value = true
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
    agentFlagEnabled.value = true
    Object.assign(consentStore, { accepted: false, isChecking: false })

    await loadEntryAndSetup()
    await vi.waitFor(() =>
      expect(useAgentConsent().withConsent).toHaveBeenCalledOnce()
    )

    expect(localStorage.getItem(AUTO_SHOWN_KEY)).toBe('true')
    expect(await notOffered()).not.toHaveBeenCalled()
  })

  it('waits for the startup decision before offering', async () => {
    agentFlagEnabled.value = true
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
    agentFlagEnabled.value = true
    Object.assign(consentStore, { accepted: false, isChecking: false })
    startupDecision = Promise.resolve(false)

    await loadEntryAndSetup()
    await nextTick()
    await flush()

    expect(useAgentConsent().withConsent).not.toHaveBeenCalled()
    expect(localStorage.getItem(AUTO_SHOWN_KEY)).toBeNull()
    expect(consentStore.load).toHaveBeenCalledOnce()
  })

  it('offers once the tour that held it ends', async () => {
    agentFlagEnabled.value = true
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
    expect(localStorage.getItem(AUTO_SHOWN_KEY)).toBe('true')
  })

  it('waits for the startup decision before re-offering after a tour ends', async () => {
    agentFlagEnabled.value = true
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
    agentFlagEnabled.value = true
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
    agentFlagEnabled.value = true
    Object.assign(consentStore, { accepted: false, isChecking: false })
    vi.mocked(useAgentConsent().withConsent).mockImplementationOnce(
      async (_trigger, _onAccept, hooks) => {
        activeTour.value = 'appMode'
        await flush()
        if (hooks?.canShow?.() === false) return
        hooks?.onShown?.()
      }
    )

    await loadEntryAndSetup()
    await vi.waitFor(() =>
      expect(useAgentConsent().withConsent).toHaveBeenCalledOnce()
    )
    await flush()
    expect(localStorage.getItem(AUTO_SHOWN_KEY)).toBe('false')
    expect(agentStore.open).not.toHaveBeenCalled()

    activeTour.value = null
    await vi.waitFor(() =>
      expect(useAgentConsent().withConsent).toHaveBeenCalledTimes(2)
    )
    expect(localStorage.getItem(AUTO_SHOWN_KEY)).toBe('true')
    expect(agentStore.open).not.toHaveBeenCalled()
  })

  it('stays silent after a tour ends when the saved consent cannot be read', async () => {
    agentFlagEnabled.value = true
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
        agentFlagEnabled.value = true
        Object.assign(consentStore, { accepted: false, isChecking: false })
        arrange()

        await loadEntryAndSetup()
        await nextTick()
        await flush()

        agentFlagEnabled.value = false
        await nextTick()
        agentFlagEnabled.value = true
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
          agentFlagEnabled.value = false
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
        agentFlagEnabled.value = true
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
      agentFlagEnabled.value = true
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

    it('reports an in-flight tour against the workspace the offer was made for', async () => {
      agentFlagEnabled.value = true
      Object.assign(consentStore, { accepted: false, isChecking: false })
      localStorage.setItem(
        'Comfy.AgentConsent.AutoShown.account-a.workspace-b',
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

      expect(await notOffered()).toHaveBeenCalledExactlyOnceWith({
        reason: 'tour_active'
      })
    })

    it('reports a reason again for a second workspace', async () => {
      agentFlagEnabled.value = true
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
      },
      {
        name: 'the one-shot offer already happened',
        arrange: () => {
          localStorage.setItem(AUTO_SHOWN_KEY, 'true')
        }
      }
    ])('reports nothing for a held offer when $name', async ({ arrange }) => {
      agentFlagEnabled.value = true
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
      agentFlagEnabled.value = false
      await nextTick()
      agentFlagEnabled.value = true
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
      },
      {
        exit: 'workspace_unresolved',
        arrange: () => {
          Object.assign(workspaceStore, { activeWorkspaceId: null })
        }
      },
      {
        exit: 'workspace_switching',
        arrange: () => {
          Object.assign(workspaceStore, { isSwitching: true })
        }
      },
      {
        // The one-shot key silences `agent_consent_not_offered` outright, so
        // this is the case that most needs its own event rather than a reason.
        exit: 'already_offered',
        arrange: () => {
          localStorage.setItem(AUTO_SHOWN_KEY, 'true')
        }
      }
    ] as const)(
      'reports $exit once however often the offer re-runs',
      async ({ exit, arrange }) => {
        agentFlagEnabled.value = true
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

    it('reports a signed-out offer separately from an unresolved account', async () => {
      agentFlagEnabled.value = true
      Object.assign(consentStore, { accepted: false, isChecking: false })
      const { useCurrentUser } =
        await import('@/composables/auth/useCurrentUser')
      vi.mocked(useCurrentUser()).isLoggedIn = computed(() => false)

      await loadEntryAndSetup()
      await flush()

      expect(await offerExited()).toHaveBeenCalledExactlyOnceWith({
        exit: 'signed_out',
        stage: 'offer',
        retry_armed: false
      })
    })

    it('reports an account that went missing after the consent read succeeded', async () => {
      // `isLoggedIn` true with no resolved id is the API-key rail before its
      // user is known - the only way these two conditions come apart, and the
      // reason they are separate values rather than one.
      agentFlagEnabled.value = true
      Object.assign(consentStore, { accepted: false, isChecking: false })
      const { useCurrentUser } =
        await import('@/composables/auth/useCurrentUser')
      vi.mocked(useCurrentUser()).isLoggedIn = computed(() => true)
      let decide = (_: boolean) => {}
      startupDecision = new Promise<boolean>((resolve) => {
        decide = resolve
      })

      await loadEntryAndSetup()
      await flush()
      currentUser.value = null
      decide(true)
      await flush()

      expect(await offerExited()).toHaveBeenCalledExactlyOnceWith({
        exit: 'account_unresolved',
        stage: 'offer',
        retry_armed: false
      })
    })

    it('reports an offer refused because another attempt is still in flight', async () => {
      agentFlagEnabled.value = true
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
      agentFlagEnabled.value = true
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
        agentFlagEnabled.value = true
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
      agentFlagEnabled.value = true
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
      agentFlagEnabled.value = true
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

    it('reports nothing for an unflagged page load', async () => {
      // Not because the reporter is gated on the flag - it is not - but because
      // `loadConsentIfEligible` returns on an off flag before reaching any
      // reported exit. That is the whole mechanism keeping this event off the
      // population outside the rollout, so it is asserted rather than assumed.
      agentFlagEnabled.value = false
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
      agentFlagEnabled.value = true
      Object.assign(consentStore, { accepted: false, isChecking: false })
      let fail = (_: Error) => {}
      vi.mocked(consentStore.load).mockReturnValueOnce(
        new Promise<boolean>((_, reject) => {
          fail = reject
        })
      )

      await loadEntryAndSetup()
      await vi.waitFor(() => expect(consentStore.load).toHaveBeenCalled())
      agentFlagEnabled.value = false
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

  it('keeps waiting when a tour ends while Getting Started is still up', async () => {
    agentFlagEnabled.value = true
    screenShown()
    activeTour.value = 'appMode'
    Object.assign(consentStore, { accepted: false, isChecking: false })

    await loadEntryAndSetup()
    await nextTick()
    await flush()
    activeTour.value = null
    await flush()

    expect(useAgentConsent().withConsent).not.toHaveBeenCalled()
    expect(localStorage.getItem(AUTO_SHOWN_KEY)).toBeNull()

    screenClosed()
    await vi.waitFor(() =>
      expect(useAgentConsent().withConsent).toHaveBeenCalledOnce()
    )
  })

  it('offers in the same session once the dialog that held it closes', async () => {
    agentFlagEnabled.value = true
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
    expect(localStorage.getItem(AUTO_SHOWN_KEY)).toBe('true')
  })

  it('keeps the held offer when the retry cannot be made, and offers on the next clear screen', async () => {
    agentFlagEnabled.value = true
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
    expect(localStorage.getItem(AUTO_SHOWN_KEY)).toBe('true')
  })

  it('keeps waiting when a tour ends while a dialog is still open', async () => {
    agentFlagEnabled.value = true
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
    agentFlagEnabled.value = true
    Object.assign(consentStore, { accepted: false, isChecking: false })
    vi.mocked(useAgentConsent().withConsent).mockImplementationOnce(
      async (_trigger, _onAccept, hooks) => {
        openDialog()
        await flush()
        if (hooks?.canShow?.() === false) return
        hooks?.onShown?.()
      }
    )

    await loadEntryAndSetup()
    await vi.waitFor(() =>
      expect(useAgentConsent().withConsent).toHaveBeenCalledOnce()
    )
    await flush()
    expect(localStorage.getItem(AUTO_SHOWN_KEY)).toBe('false')
    expect(agentStore.open).not.toHaveBeenCalled()

    closeDialog()
    await vi.waitFor(() =>
      expect(useAgentConsent().withConsent).toHaveBeenCalledTimes(2)
    )
    expect(localStorage.getItem(AUTO_SHOWN_KEY)).toBe('true')
  })

  it('re-offers after a withheld in-flight offer settles on a clear screen', async () => {
    agentFlagEnabled.value = true
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
    expect(localStorage.getItem(AUTO_SHOWN_KEY)).toBe('true')
  })

  it('does not re-offer after the user declines a manually opened card', async () => {
    agentFlagEnabled.value = true
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
    expect(localStorage.getItem(AUTO_SHOWN_KEY)).toBeNull()
  })

  it('skips the automatic offer for the session once the user has seen the card', async () => {
    agentFlagEnabled.value = true
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
    agentFlagEnabled.value = true
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
    agentFlagEnabled.value = true
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
    agentFlagEnabled.value = true
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
      offers: 2,
      shown: 'true'
    },
    {
      outcome: 'fails',
      load: () => Promise.reject(new Error('offline')),
      offers: 1,
      shown: null
    }
  ])(
    'rechecks a missed account change once when the next consent load $outcome',
    async ({ load, offers, shown }) => {
      agentFlagEnabled.value = true
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
      expect(
        localStorage.getItem(
          'Comfy.AgentConsent.AutoShown.account-b.workspace-a'
        )
      ).toBe(shown)
    }
  )

  it.for([
    { userId: 'account-b', workspaceId: 'workspace-a' },
    { userId: 'account-a', workspaceId: 'workspace-b' }
  ])(
    'offers independently for $userId / $workspaceId',
    async ({ userId, workspaceId }) => {
      agentFlagEnabled.value = true
      Object.assign(consentStore, { accepted: false, isChecking: false })
      vi.mocked(useAgentConsent().withConsent).mockImplementationOnce(
        async (_trigger, _onAccept, hooks) => {
          hooks?.onShown?.()
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

  it.for(['getItem', 'setItem'] as const)(
    'skips the automatic offer when storage %s fails',
    async (method) => {
      agentFlagEnabled.value = true
      Object.assign(consentStore, { accepted: false, isChecking: false })
      vi.spyOn(localStorage, method).mockImplementation(() => {
        throw new Error('Storage unavailable')
      })

      await loadEntryAndSetup()
      await flush()

      expect(useAgentConsent().withConsent).not.toHaveBeenCalled()
      expect(await notOffered()).toHaveBeenCalledExactlyOnceWith({
        reason: 'storage_unavailable'
      })
    }
  )

  it('stays silent when the saved consent cannot be read', async () => {
    agentFlagEnabled.value = true
    Object.assign(consentStore, { accepted: false, isChecking: false })
    vi.mocked(consentStore.load).mockRejectedValue(new Error('offline'))

    await loadEntryAndSetup()
    await flush()

    expect(useAgentConsent().withConsent).not.toHaveBeenCalled()
    expect(await notOffered()).not.toHaveBeenCalled()
  })

  it('forces the panel on in development even while the flag is false', async () => {
    vi.stubEnv('MODE', 'development')
    agentFlagEnabled.value = false

    await loadEntryAndSetup()

    expect(agentStore.enabled).toBe(true)
    expect(consentStore.load).toHaveBeenCalledOnce()
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
    agentFlagEnabled.value = true
    await loadEntryAndSetup()
    expect(consentStore.load).toHaveBeenCalledOnce()
    currentUser.value = { id: 'account-b' }
    await flush()
    expect(consentStore.load).toHaveBeenCalledTimes(2)
  })

  it('reloads consent when the same user changes workspace scope', async () => {
    agentFlagEnabled.value = true
    await loadEntryAndSetup()
    expect(consentStore.load).toHaveBeenCalledOnce()
    Object.assign(consentStore, { identity: 'account-a/workspace-b' })
    await flush()
    expect(consentStore.load).toHaveBeenCalledTimes(2)
  })

  it('does not start selection restoration without accepted consent', async () => {
    const { registerAgentPanelExtension } = await import('./agentPanel')
    registerAgentPanelExtension()
    const extension = mocks.capturedExtensions.find(
      (item) => item.name === 'Comfy.AgentPanel'
    )
    agentStore.enabled = true
    agentStore.consentAccepted = false
    await extension!.beforeLoadGraph!({} as never)
    expect(nodeSelectionStore.beginWorkflowLoad).not.toHaveBeenCalled()
    await extension!.afterConfigureGraph!([], {} as never)
  })

  it('enables the panel when the flag turns true', async () => {
    await loadEntryAndSetup()
    agentFlagEnabled.value = true
    await nextTick()
    expect(agentStore.enabled).toBe(true)
  })

  it('leaves the gate unsettled while only the anonymous config has landed', async () => {
    await setRemoteConfigState('unloaded')

    await loadEntryAndSetup()

    expect(agentStore.gateSettled).toBe(false)
  })

  it('settles the gate once the authenticated config lands', async () => {
    await loadEntryAndSetup()
    expect(agentStore.gateSettled).toBe(false)

    await setRemoteConfigState('authenticated')

    expect(agentStore.gateSettled).toBe(true)
  })

  it('settles the gate when the config load fails rather than waiting forever', async () => {
    await loadEntryAndSetup()

    await setRemoteConfigState('error')

    expect(agentStore.gateSettled).toBe(true)
  })

  it('settles the gate on the fallback when no authenticated config ever lands', async () => {
    currentUser.value = null
    await setRemoteConfigState('unloaded')
    await loadEntryAndSetup()
    expect(agentStore.gateSettled).toBe(false)

    const { GATE_SETTLE_TIMEOUT_MS } = await import('./agentPanel')
    await vi.advanceTimersByTimeAsync(GATE_SETTLE_TIMEOUT_MS)

    expect(agentStore.gateSettled).toBe(true)
  })

  it('does not settle a signed-in gate while authenticated config is slow', async () => {
    await setRemoteConfigState('loading')
    await loadEntryAndSetup()

    const { GATE_SETTLE_TIMEOUT_MS } = await import('./agentPanel')
    await vi.advanceTimersByTimeAsync(GATE_SETTLE_TIMEOUT_MS)

    expect(agentStore.gateSettled).toBe(false)
  })

  it('does not treat unresolved auth as signed out', async () => {
    currentUser.value = null
    isAuthInitialized.value = false
    await setRemoteConfigState('unloaded')
    await loadEntryAndSetup()

    const { GATE_SETTLE_TIMEOUT_MS } = await import('./agentPanel')
    await vi.advanceTimersByTimeAsync(GATE_SETTLE_TIMEOUT_MS)

    expect(agentStore.gateSettled).toBe(false)
  })

  it('re-arms the signed-out fallback after an identity change', async () => {
    await setRemoteConfigState('authenticated')
    await loadEntryAndSetup()
    expect(agentStore.gateSettled).toBe(true)

    currentUser.value = null
    await setRemoteConfigState('unloaded')
    const { GATE_SETTLE_TIMEOUT_MS } = await import('./agentPanel')
    await vi.advanceTimersByTimeAsync(GATE_SETTLE_TIMEOUT_MS)

    expect(agentStore.gateSettled).toBe(true)
  })

  it('returns the gate to unsettled when authenticated config reloads', async () => {
    await setRemoteConfigState('authenticated')
    await loadEntryAndSetup()
    expect(agentStore.gateSettled).toBe(true)

    await setRemoteConfigState('loading')

    expect(agentStore.gateSettled).toBe(false)
  })

  it('retries consent after a completed refresh with the same flag value', async () => {
    agentFlagEnabled.value = true
    Object.assign(consentStore, { accepted: false, isChecking: false })
    await loadEntryAndSetup()
    vi.mocked(consentStore.load).mockClear()
    const { remoteConfigRevision } =
      await import('@/platform/remoteConfig/remoteConfig')

    remoteConfigRevision.value++
    await nextTick()

    expect(consentStore.load).toHaveBeenCalledOnce()
  })

  it('disables the panel without closing it when the flag flips back to false', async () => {
    await loadEntryAndSetup()
    agentFlagEnabled.value = true
    await nextTick()
    agentFlagEnabled.value = false
    await nextTick()

    expect(agentStore.enabled).toBe(false)
    expect(agentStore.close).not.toHaveBeenCalled()
    expect(agentStore.isOpen).toBe(true)
  })

  it('finishes a pending selection restore when the flag is disabled', async () => {
    await loadEntryAndSetup()
    agentFlagEnabled.value = true
    await nextTick()
    nodeSelectionStore.isLoadingWorkflow = true

    agentFlagEnabled.value = false
    await nextTick()

    expect(nodeSelectionStore.finishWorkflowLoad).toHaveBeenCalledOnce()
  })

  it('restores each workflow reference after the shared graph load', async () => {
    const { registerAgentPanelExtension } = await import('./agentPanel')
    const { getNodeByLocatorId } = await import('@/utils/graphTraversalUtil')
    registerAgentPanelExtension()
    const extension = mocks.capturedExtensions.find(
      (item) => item.name === 'Comfy.AgentPanel'
    )
    const secondNode = new LGraphNode('Second')
    secondNode.id = toNodeId(12)
    const rootGraph = {}
    const selectItems = vi.fn()
    agentStore.enabled = true
    agentStore.consentAccepted = true

    await extension!.beforeLoadGraph!({} as never)

    expect(nodeSelectionStore.beginWorkflowLoad).toHaveBeenCalledOnce()

    nodeSelectionStore.isLoadingWorkflow = true
    nodeSelectionStore.nodeIds.mockReturnValue(['12'])
    vi.mocked(getNodeByLocatorId).mockReturnValue(secondNode)
    workflowStore.activeWorkflow = createMockLoadedWorkflow({
      path: 'workflows/second.json'
    })

    await extension!.afterLoadGraph!({
      rootGraph,
      canvas: {
        selectItems
      }
    } as never)

    expect(getNodeByLocatorId).toHaveBeenCalledWith(rootGraph, '12')
    expect(selectItems).toHaveBeenCalledWith([secondNode])
    expect(nodeSelectionStore.restoreNodeIds).toHaveBeenCalledWith(['12'])
    expect(nodeSelectionStore.finishWorkflowLoad).not.toHaveBeenCalled()
    await extension!.afterConfigureGraph!([], {} as never)
  })

  it('disarms the restore guard on an empty restore instead of leaving it armed', async () => {
    const { registerAgentPanelExtension } = await import('./agentPanel')
    registerAgentPanelExtension()
    const extension = mocks.capturedExtensions.find(
      (item) => item.name === 'Comfy.AgentPanel'
    )
    const rootGraph = {}
    const selectItems = vi.fn()
    agentStore.enabled = true
    agentStore.consentAccepted = true
    nodeSelectionStore.isLoadingWorkflow = true
    nodeSelectionStore.nodeIds.mockReturnValue([])
    workflowStore.activeWorkflow = createMockLoadedWorkflow({
      path: 'workflows/brand-new-unsaved.json'
    })

    await extension!.afterLoadGraph!({
      rootGraph,
      canvas: { selectItems }
    } as never)

    // The guard is disarmed directly, rather than armed with an empty
    // selection, so a later unrelated selection change (e.g. manually adding
    // a node) can't be misattributed as "the restored selection".
    expect(nodeSelectionStore.finishWorkflowLoad).toHaveBeenCalledOnce()
    expect(nodeSelectionStore.restoreNodeIds).not.toHaveBeenCalled()
    expect(selectItems).not.toHaveBeenCalled()
  })

  it('restores a subgraph reference by its locator after graph load', async () => {
    const { registerAgentPanelExtension } = await import('./agentPanel')
    const { getNodeByLocatorId } = await import('@/utils/graphTraversalUtil')
    registerAgentPanelExtension()
    const extension = mocks.capturedExtensions.find(
      (item) => item.name === 'Comfy.AgentPanel'
    )
    const locator = '12345678-1234-1234-1234-123456789abc:shared'
    const subgraph = createTestSubgraph({
      id: '12345678-1234-1234-1234-123456789abc'
    })
    const subgraphNode = new LGraphNode('Subgraph node')
    subgraphNode.id = toNodeId('shared')
    subgraph.add(subgraphNode)
    const rootGraph = {}
    const selectItems = vi.fn()

    agentStore.enabled = true
    agentStore.consentAccepted = true
    nodeSelectionStore.isLoadingWorkflow = true
    nodeSelectionStore.nodeIds.mockReturnValue([locator])
    vi.mocked(getNodeByLocatorId).mockReturnValue(subgraphNode)

    await extension!.afterLoadGraph!({
      rootGraph,
      canvas: { selectItems }
    } as never)

    expect(getNodeByLocatorId).toHaveBeenCalledWith(rootGraph, locator)
    expect(selectItems).toHaveBeenCalledWith([subgraphNode])
    expect(nodeSelectionStore.restoreNodeIds).toHaveBeenCalledWith([locator])
  })

  it('skips graph-load selection tracking while the panel is closed', async () => {
    const { registerAgentPanelExtension } = await import('./agentPanel')
    registerAgentPanelExtension()
    const extension = mocks.capturedExtensions.find(
      (item) => item.name === 'Comfy.AgentPanel'
    )
    agentStore.isOpen = false

    await extension!.beforeLoadGraph!({} as never)

    expect(nodeSelectionStore.beginWorkflowLoad).not.toHaveBeenCalled()
    await extension!.afterConfigureGraph!([], {} as never)
  })

  it('finishes restoration when the panel closes during graph load', async () => {
    const { registerAgentPanelExtension } = await import('./agentPanel')
    const { getNodeByLocatorId } = await import('@/utils/graphTraversalUtil')
    registerAgentPanelExtension()
    const extension = mocks.capturedExtensions.find(
      (item) => item.name === 'Comfy.AgentPanel'
    )
    agentStore.isOpen = false
    nodeSelectionStore.isLoadingWorkflow = true

    await extension!.afterLoadGraph!({} as never)

    expect(nodeSelectionStore.finishWorkflowLoad).toHaveBeenCalledOnce()
    expect(getNodeByLocatorId).not.toHaveBeenCalled()
  })

  it('finishes restoration when graph configuration fails', async () => {
    const { registerAgentPanelExtension } = await import('./agentPanel')
    registerAgentPanelExtension()
    const extension = mocks.capturedExtensions.find(
      (item) => item.name === 'Comfy.AgentPanel'
    )
    nodeSelectionStore.isLoadingWorkflow = true

    await extension!.onGraphLoadError!(
      new Error('bad workflow json'),
      {} as never
    )

    expect(nodeSelectionStore.finishWorkflowLoad).toHaveBeenCalledOnce()
  })

  it('finishes restoration when selection restoration throws', async () => {
    const { registerAgentPanelExtension } = await import('./agentPanel')
    const { getNodeByLocatorId } = await import('@/utils/graphTraversalUtil')
    registerAgentPanelExtension()
    const extension = mocks.capturedExtensions.find(
      (item) => item.name === 'Comfy.AgentPanel'
    )
    agentStore.enabled = true
    agentStore.consentAccepted = true
    agentStore.isOpen = true
    nodeSelectionStore.isLoadingWorkflow = true
    nodeSelectionStore.nodeIds.mockReturnValue(['12'])
    vi.mocked(getNodeByLocatorId).mockImplementation(() => {
      throw new Error('selection restore failed')
    })

    expect(() =>
      extension!.afterLoadGraph!({ rootGraph: {} } as never)
    ).toThrow('selection restore failed')
    expect(nodeSelectionStore.finishWorkflowLoad).toHaveBeenCalledOnce()
  })

  it('does not start selection restoration while the flag is disabled', async () => {
    const { registerAgentPanelExtension } = await import('./agentPanel')
    registerAgentPanelExtension()
    const extension = mocks.capturedExtensions.find(
      (item) => item.name === 'Comfy.AgentPanel'
    )

    await extension!.beforeLoadGraph!({} as never)

    expect(nodeSelectionStore.beginWorkflowLoad).not.toHaveBeenCalled()
    await extension!.afterConfigureGraph!([], {} as never)
  })

  it('does not self-register when its module is imported', () => {
    expect(importRegistrationCount).toBe(0)
  })
})
