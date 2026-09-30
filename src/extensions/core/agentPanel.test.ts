import { fromPartial } from '@total-typescript/shoehorn'
vi.mock(import('firebase/auth'))
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mocked } from 'vitest'
import { computed, effectScope, nextTick, reactive, ref } from 'vue'
import type { EffectScope } from 'vue'
let setupScope: EffectScope
import { useAgentConsentStore } from '@/workbench/extensions/agent/stores/agent/agentConsentStore'

import type { ComfyExtension } from '@/types/comfy'
import type { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useOnboardingTourStore } from '@/platform/onboarding/onboardingTourStore'
import type { EntryPath } from '@/platform/onboarding/onboardingTours'
import type { useFirstRunEntry } from '@/renderer/extensions/firstRunTour/gettingStarted/firstRunEntry'
import { useAgentConsent } from '@/workbench/extensions/agent/composables/agent/useAgentConsent'
import type { ConsentOfferHooks } from '@/workbench/extensions/agent/composables/agent/useAgentConsent'
import { useTelemetry } from '@/platform/telemetry'
import type { useExtensionService } from '@/services/extensionService'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useAgentNodeSelectionStore } from '@/stores/agentNodeSelectionStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import type { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'
import { createMockLoadedWorkflow } from '@/utils/__tests__/litegraphTestUtils'
import { getNodeByLocatorId } from '@/utils/graphTraversalUtil'
import { isLGraphNode } from '@/utils/litegraphUtil'

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
const firstRunTookScreen = computed({
  get: () => firstRunHoldsScreen.value,
  set: (value: boolean) => {
    firstRunScreenState.value = value ? 'visible' : 'released'
  }
})
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

vi.mock(import('@/composables/auth/useCurrentUser'), () => ({
  useCurrentUser: () =>
    fromPartial<ReturnType<typeof useCurrentUser>>({
      resolvedUserInfo: currentUser,
      isAuthInitialized,
      isLoggedIn: computed(() => currentUser.value !== null)
    })
}))

vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: vi.fn()
}))
vi.mock(import('@/platform/telemetry'))

vi.mock(
  import('@/workbench/extensions/agent/composables/agent/useAgentConsent'),
  () => {
    const consent = fromPartial<ReturnType<typeof useAgentConsent>>({
      withConsent: vi.fn(
        async (onAccept: () => void, hooks?: ConsentOfferHooks) => {
          if (hooks?.canShow?.() === false) return
          hooks?.onShown?.()
          onAccept()
        }
      )
    })
    return { useAgentConsent: () => consent }
  }
)

const mocks = vi.hoisted(() => ({
  capturedExtensions: [] as ComfyExtension[],
  notifyAfterGraphConfigure: vi.fn(),
  notifyBeforeGraphLoad: vi.fn(),
  getNodeByLocatorId: vi.fn(),
  registerTracker: vi.fn(() => () => {})
}))

vi.mock(import('@/workbench/extensions/agent/crdt/restoreOpMinter'), () => ({
  notifyRestoreMintersAfterGraphConfigure: mocks.notifyAfterGraphConfigure,
  notifyRestoreMintersBeforeGraphLoad: mocks.notifyBeforeGraphLoad,
  notifyRestoreMintersGraphLoadError: vi.fn()
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
    registerWorkflowTabActivityTracker: mocks.registerTracker
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

const flush = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 0))

const notOffered = async () =>
  vi.mocked(
    (await import('@/platform/telemetry')).useTelemetry()!
      .trackAgentConsentNotOffered
  )

async function loadEntryAndSetup(): Promise<void> {
  const { registerAgentPanelExtension } = await import('./agentPanel')
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

describe('AgentPanel extension flag gate', () => {
  afterEach(() => setupScope.stop())

  beforeEach(() => {
    vi.resetModules()
    setupScope = effectScope()
    currentUser.value = { id: 'account-a' }
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
    vi.mocked(getNodeByLocatorId).mockImplementation(mocks.getNodeByLocatorId)
    agentStore = vi.mocked(useAgentPanelStore())
    agentStore.consentAccepted = false
    nodeSelectionStore = vi.mocked(useAgentNodeSelectionStore())
    workflowStore = useWorkflowStore()
    nodeSelectionStore.restoreNodeIds.mockImplementation(() => {})
    mocks.capturedExtensions.length = 0
    mocks.notifyAfterGraphConfigure.mockClear()
    mocks.notifyBeforeGraphLoad.mockClear()
    agentStore.close.mockClear()
    agentStore.enabled = false
    agentStore.isOpen = true
    agentFlagEnabled.value = false
    agentFlagEnabled.value = false
    releaseFirstRunScreen()
    activeTour.value = null
    startupDecision = Promise.resolve(true)
    vi.spyOn(useOnboardingTourStore(), 'activeTour', 'get').mockImplementation(
      () => activeTour.value
    )
    mocks.registerTracker.mockClear()
    localStorage.clear()
    mocks.getNodeByLocatorId.mockReset()
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
    const trackAgentPanelOpened = vi.fn()
    vi.mocked(useTelemetry).mockReturnValue(
      fromPartial<NonNullable<ReturnType<typeof useTelemetry>>>({
        trackAgentPanelOpened
      })
    )
    vi.mocked(useAgentConsent().withConsent).mockImplementationOnce(
      async (onAccept, hooks) => {
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
    expect(agentStore.open).not.toHaveBeenCalled()
    expect(trackAgentPanelOpened).toHaveBeenCalledExactlyOnceWith({
      source: 'restored'
    })
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
      async (onAccept) => {
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
      async (_onAccept, hooks) => {
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
      surface: 'Getting Started took the screen this boot',
      arrange: () => void (firstRunTookScreen.value = true)
    },
    {
      surface: 'a coachmark tour is active',
      arrange: () => void (activeTour.value = 'appMode')
    },
    {
      surface: 'Getting Started took the screen and a tour is active',
      arrange: () => {
        firstRunTookScreen.value = true
        activeTour.value = 'appMode'
      }
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

    releaseFirstRunScreen()
    await vi.waitFor(() =>
      expect(useAgentConsent().withConsent).toHaveBeenCalledOnce()
    )
  })

  it('keeps waiting across the Getting Started to tour handoff', async () => {
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
      async (_onAccept, hooks) => {
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
          firstRunTookScreen.value = true
        }
      },
      {
        reason: 'tour_active',
        arrange: () => {
          activeTour.value = 'appMode'
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

    it('reports an in-flight tour against the workspace the offer was made for', async () => {
      agentFlagEnabled.value = true
      Object.assign(consentStore, { accepted: false, isChecking: false })
      localStorage.setItem(
        'Comfy.AgentConsent.AutoShown.account-a.workspace-b',
        'true'
      )
      vi.mocked(useAgentConsent().withConsent).mockImplementationOnce(
        async (_onAccept, hooks) => {
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

  it('keeps withholding after a tour ends when Getting Started took the screen', async () => {
    agentFlagEnabled.value = true
    firstRunTookScreen.value = true
    activeTour.value = 'appMode'
    Object.assign(consentStore, { accepted: false, isChecking: false })

    await loadEntryAndSetup()
    await nextTick()
    await flush()
    activeTour.value = null
    await flush()

    expect(useAgentConsent().withConsent).not.toHaveBeenCalled()
    expect(localStorage.getItem(AUTO_SHOWN_KEY)).toBeNull()
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

  it('does not self-register when its module is imported', async () => {
    await import('./agentPanel')

    expect(mocks.capturedExtensions).toEqual([])
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
    expect(mocks.registerTracker).toHaveBeenCalledTimes(1)
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
    expect(mocks.notifyBeforeGraphLoad).toHaveBeenCalledOnce()
    expect(nodeSelectionStore.beginWorkflowLoad).not.toHaveBeenCalled()
  })

  it('enables the panel when the flag turns true', async () => {
    await loadEntryAndSetup()
    agentFlagEnabled.value = true
    await nextTick()
    expect(agentStore.enabled).toBe(true)
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
    registerAgentPanelExtension()
    const extension = mocks.capturedExtensions.find(
      (item) => item.name === 'Comfy.AgentPanel'
    )
    const secondNode = { id: 12 }
    const rootGraph = {}
    const selectItems = vi.fn()
    agentStore.enabled = true
    agentStore.consentAccepted = true

    await extension!.beforeLoadGraph!({} as never)

    expect(mocks.notifyBeforeGraphLoad).toHaveBeenCalledOnce()
    expect(nodeSelectionStore.beginWorkflowLoad).toHaveBeenCalledOnce()

    nodeSelectionStore.isLoadingWorkflow = true
    nodeSelectionStore.nodeIds.mockReturnValue(['12'])
    mocks.getNodeByLocatorId.mockReturnValue(secondNode)
    workflowStore.activeWorkflow = createMockLoadedWorkflow({
      path: 'workflows/second.json'
    })

    await extension!.afterLoadGraph!({
      rootGraph,
      canvas: {
        selectItems
      }
    } as never)

    expect(mocks.getNodeByLocatorId).toHaveBeenCalledWith(rootGraph, '12')
    expect(selectItems).toHaveBeenCalledWith([secondNode])
    expect(nodeSelectionStore.restoreNodeIds).toHaveBeenCalledWith(['12'])
    expect(nodeSelectionStore.finishWorkflowLoad).not.toHaveBeenCalled()
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
    registerAgentPanelExtension()
    const extension = mocks.capturedExtensions.find(
      (item) => item.name === 'Comfy.AgentPanel'
    )
    const locator = '12345678-1234-1234-1234-123456789abc:shared'
    const subgraphNode = {
      id: 'shared',
      graph: { id: '12345678-1234-1234-1234-123456789abc', isRootGraph: false }
    }
    const rootGraph = {}
    const selectItems = vi.fn()

    agentStore.enabled = true
    agentStore.consentAccepted = true
    nodeSelectionStore.isLoadingWorkflow = true
    nodeSelectionStore.nodeIds.mockReturnValue([locator])
    mocks.getNodeByLocatorId.mockReturnValue(subgraphNode)

    await extension!.afterLoadGraph!({
      rootGraph,
      canvas: { selectItems }
    } as never)

    expect(mocks.getNodeByLocatorId).toHaveBeenCalledWith(rootGraph, locator)
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

    expect(mocks.notifyBeforeGraphLoad).toHaveBeenCalledOnce()
    expect(nodeSelectionStore.beginWorkflowLoad).not.toHaveBeenCalled()
  })

  it('finishes restoration when the panel closes during graph load', async () => {
    const { registerAgentPanelExtension } = await import('./agentPanel')
    registerAgentPanelExtension()
    const extension = mocks.capturedExtensions.find(
      (item) => item.name === 'Comfy.AgentPanel'
    )
    agentStore.isOpen = false
    nodeSelectionStore.isLoadingWorkflow = true

    await extension!.afterLoadGraph!({} as never)

    expect(nodeSelectionStore.finishWorkflowLoad).toHaveBeenCalledOnce()
    expect(mocks.getNodeByLocatorId).not.toHaveBeenCalled()
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
    registerAgentPanelExtension()
    const extension = mocks.capturedExtensions.find(
      (item) => item.name === 'Comfy.AgentPanel'
    )
    agentStore.enabled = true
    agentStore.consentAccepted = true
    agentStore.isOpen = true
    nodeSelectionStore.isLoadingWorkflow = true
    nodeSelectionStore.nodeIds.mockReturnValue(['12'])
    mocks.getNodeByLocatorId.mockImplementation(() => {
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
  })
})
