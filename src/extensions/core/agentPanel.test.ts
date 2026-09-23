import { fromPartial } from '@total-typescript/shoehorn'
vi.mock(import('firebase/auth'))
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mocked } from 'vitest'
import { computed, effectScope, ref } from 'vue'
import type { EffectScope } from 'vue'
let setupScope: EffectScope
import { useAgentConsentStore } from '@/workbench/extensions/agent/stores/agent/agentConsentStore'
import {
  notifyMintPortsAfterGraphConfigure,
  notifyMintPortsBeforeGraphLoad
} from '@/workbench/extensions/agent/crdt/mintPortWiring'
import { registerWorkflowTabActivityTracker } from '@/workbench/extensions/agent/services/agent/workflowTabActivityTracker'

import type { ComfyExtension } from '@/types/comfy'
import { useAgentConsent } from '@/workbench/extensions/agent/composables/agent/useAgentConsent'
import { useTelemetry } from '@/platform/telemetry'
import type { useExtensionService } from '@/services/extensionService'
import type { PostHog } from 'posthog-js'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { createTestSubgraph } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useAgentNodeSelectionStore } from '@/stores/agentNodeSelectionStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'
import { createMockLoadedWorkflow } from '@/utils/__tests__/litegraphTestUtils'
import { getNodeByLocatorId } from '@/utils/graphTraversalUtil'
import { isLGraphNode } from '@/utils/litegraphUtil'
import { toNodeId } from '@/types/nodeId'
import { widgetId } from '@/types/widgetId'

let agentStore: Mocked<ReturnType<typeof useAgentPanelStore>>
let nodeSelectionStore: Mocked<ReturnType<typeof useAgentNodeSelectionStore>>
let workflowStore: ReturnType<typeof useWorkflowStore>
let consentStore: ReturnType<typeof useAgentConsentStore>
let workspaceStore: ReturnType<typeof useTeamWorkspaceStore>

const currentUser = ref<{ id: string } | null>({ id: 'account-a' })

vi.mock(import('@/composables/auth/useCurrentUser'))

vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: vi.fn()
}))
vi.mock(import('@/platform/telemetry'))

vi.mock(
  import('@/workbench/extensions/agent/composables/agent/useAgentConsent'),
  () => {
    const consent = fromPartial<ReturnType<typeof useAgentConsent>>({
      withConsent: vi.fn(async (onAccept: () => void, onShown?: () => void) => {
        onShown?.()
        onAccept()
      })
    })
    return { useAgentConsent: () => consent }
  }
)

const mocks = vi.hoisted(() => ({
  capturedExtensions: [] as ComfyExtension[],
  flagEnabled: undefined as boolean | undefined,
  flagListener: null as (() => void) | null
}))

vi.mock(import('@/services/extensionService'), () => ({
  useExtensionService: () =>
    fromPartial<ReturnType<typeof useExtensionService>>({
      registerExtension: (ext: ComfyExtension) => {
        mocks.capturedExtensions.push(ext)
      }
    })
}))

vi.mock(import('@/workbench/extensions/agent/crdt/mintPortWiring'), () => ({
  notifyMintPortsAfterGraphConfigure: vi.fn(),
  notifyMintPortsBeforeGraphLoad: vi.fn()
}))

vi.mock(import('@/utils/litegraphUtil'), { spy: true })
vi.mock(import('@/utils/graphTraversalUtil'), { spy: true })

vi.mock(
  import('@/workbench/extensions/agent/services/agent/workflowTabActivityTracker'),
  () => ({
    registerWorkflowTabActivityTracker: vi.fn(() => () => {})
  })
)

vi.mock(import('posthog-js'), () => ({
  default: fromPartial<PostHog>({
    isFeatureEnabled: () => mocks.flagEnabled,
    onFeatureFlags: (listener: () => void) => {
      mocks.flagListener = listener
      return () => {}
    }
  })
}))

const flush = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 0))

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
  for (let i = 0; i < 2000 && mocks.flagListener === null; i++) await flush()
  expect(mocks.flagListener).toBeTypeOf('function')
}

describe('AgentPanel extension flag gate', () => {
  afterEach(() => setupScope.stop())

  beforeEach(async () => {
    vi.resetModules()
    const { useCurrentUser } = await import('@/composables/auth/useCurrentUser')
    const currentUserService = vi.mocked(useCurrentUser())
    currentUserService.resolvedUserInfo = computed(() => currentUser.value)
    currentUserService.isLoggedIn = computed(() => currentUser.value !== null)
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
    agentStore = vi.mocked(useAgentPanelStore())
    agentStore.consentAccepted = false
    nodeSelectionStore = vi.mocked(useAgentNodeSelectionStore())
    workflowStore = useWorkflowStore()
    nodeSelectionStore.restoreNodeIds.mockImplementation(() => {})
    mocks.capturedExtensions.length = 0
    agentStore.close.mockClear()
    agentStore.enabled = false
    agentStore.isOpen = true
    mocks.flagEnabled = undefined
    mocks.flagListener = null
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
    mocks.flagEnabled = true
    Object.assign(consentStore, { accepted: false, isChecking: false })
    vi.mocked(useAgentConsent().withConsent).mockImplementationOnce(
      async (onAccept, onShown) => {
        onShown?.()
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
    expect(agentStore.open).toHaveBeenCalledExactlyOnceWith('automatic_consent')
    expect(
      useTelemetry()?.trackAgentPanelOpened
    ).toHaveBeenCalledExactlyOnceWith({ source: 'automatic_consent' })
  })

  it('keeps the panel closed if the feature is disabled before acceptance', async () => {
    mocks.flagEnabled = true
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
    mocks.flagEnabled = false
    mocks.flagListener?.()
    accept()
    finish()
    await pending

    expect(agentStore.open).not.toHaveBeenCalled()
  })

  it('records the automatic offer only after the card is displayed', async () => {
    mocks.flagEnabled = true
    Object.assign(consentStore, { accepted: false, isChecking: false })
    const key = 'Comfy.AgentConsent.AutoShown.account-a.workspace-a'
    let show = () => {}
    let finish = () => {}
    const pending = new Promise<void>((resolve) => {
      finish = resolve
    })
    vi.mocked(useAgentConsent().withConsent).mockImplementationOnce(
      async (_onAccept, onShown) => {
        show = onShown ?? show
        await pending
      }
    )

    await loadEntryAndSetup()
    await vi.waitFor(() =>
      expect(useAgentConsent().withConsent).toHaveBeenCalledOnce()
    )
    expect(localStorage.getItem(key)).not.toBe('true')
    mocks.flagListener?.()
    await flush()
    expect(useAgentConsent().withConsent).toHaveBeenCalledOnce()

    show()
    expect(localStorage.getItem(key)).toBe('true')
    finish()
    await pending
  })

  it('offers again after a previous attempt returned without displaying the card', async () => {
    mocks.flagEnabled = true
    Object.assign(consentStore, { accepted: false, isChecking: false })
    vi.mocked(useAgentConsent().withConsent).mockResolvedValueOnce(undefined)

    await loadEntryAndSetup()
    await vi.waitFor(() =>
      expect(useAgentConsent().withConsent).toHaveBeenCalledOnce()
    )
    mocks.flagListener?.()
    await vi.waitFor(() =>
      expect(useAgentConsent().withConsent).toHaveBeenCalledTimes(2)
    )

    expect(agentStore.open).toHaveBeenCalledOnce()
  })

  it('stays silent when the account already accepted', async () => {
    mocks.flagEnabled = true
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
      mocks.flagEnabled = true
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
      mocks.flagEnabled = true
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
      mocks.flagEnabled = true
      Object.assign(consentStore, { accepted: false, isChecking: false })
      vi.spyOn(localStorage, method).mockImplementation(() => {
        throw new Error('Storage unavailable')
      })

      await loadEntryAndSetup()
      await flush()

      expect(useAgentConsent().withConsent).not.toHaveBeenCalled()
    }
  )

  it('stays silent when the saved consent cannot be read', async () => {
    mocks.flagEnabled = true
    Object.assign(consentStore, { accepted: false, isChecking: false })
    vi.mocked(consentStore.load).mockRejectedValue(new Error('offline'))

    await loadEntryAndSetup()
    await flush()

    expect(useAgentConsent().withConsent).not.toHaveBeenCalled()
  })

  it('does not self-register when its module is imported', async () => {
    await import('./agentPanel')

    expect(mocks.capturedExtensions).toEqual([])
  })

  it('forces the panel on in development even while the flag is false', async () => {
    vi.stubEnv('MODE', 'development')
    mocks.flagEnabled = false

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
    mocks.flagEnabled = true
    await loadEntryAndSetup()
    expect(consentStore.load).toHaveBeenCalledOnce()
    currentUser.value = { id: 'account-b' }
    await flush()
    expect(consentStore.load).toHaveBeenCalledTimes(2)
  })

  it('reloads consent when the same user changes workspace scope', async () => {
    mocks.flagEnabled = true
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
    expect(notifyMintPortsBeforeGraphLoad).toHaveBeenCalledOnce()
    expect(nodeSelectionStore.beginWorkflowLoad).not.toHaveBeenCalled()
  })

  it('enables the panel when the flag turns true', async () => {
    await loadEntryAndSetup()
    mocks.flagEnabled = true
    mocks.flagListener!()
    expect(agentStore.enabled).toBe(true)
  })

  it('disables the panel without closing it when the flag flips back to false', async () => {
    await loadEntryAndSetup()
    mocks.flagEnabled = true
    mocks.flagListener!()
    mocks.flagEnabled = false
    mocks.flagListener!()

    expect(agentStore.enabled).toBe(false)
    expect(agentStore.close).not.toHaveBeenCalled()
    expect(agentStore.isOpen).toBe(true)
  })

  it('finishes a pending selection restore when the flag is disabled', async () => {
    await loadEntryAndSetup()
    mocks.flagEnabled = true
    mocks.flagListener!()
    nodeSelectionStore.isLoadingWorkflow = true

    mocks.flagEnabled = false
    mocks.flagListener!()

    expect(nodeSelectionStore.finishWorkflowLoad).toHaveBeenCalledOnce()
  })

  it('restores each workflow reference after the shared graph load', async () => {
    const { registerAgentPanelExtension } = await import('./agentPanel')
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

    expect(notifyMintPortsBeforeGraphLoad).toHaveBeenCalledOnce()
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

  it('closes the mint suppression bracket after graph configuration', async () => {
    const { registerAgentPanelExtension } = await import('./agentPanel')
    registerAgentPanelExtension()
    const extension = mocks.capturedExtensions.find(
      (item) => item.name === 'Comfy.AgentPanel'
    )

    await extension!.afterConfigureGraph!([], {} as never)

    expect(notifyMintPortsAfterGraphConfigure).toHaveBeenCalledOnce()
  })

  it('resumes ordinary local-dirty tracking after a failed load is followed by a successful one', async () => {
    const { registerAgentPanelExtension } = await import('./agentPanel')
    registerAgentPanelExtension()
    const extension = mocks.capturedExtensions.find(
      (item) => item.name === 'Comfy.AgentPanel'
    )
    const widgetStore = useWidgetValueStore()
    const id = widgetId('graph-a', toNodeId(1), 'value')
    const registered = widgetStore.registerWidget<number>(id, {
      type: 'number',
      value: 1,
      options: {}
    })!

    // A load whose configure() throws before `afterConfigureGraph` ever runs.
    await extension!.beforeLoadGraph!({} as never)
    await extension!.onGraphLoadError!(
      new Error('bad workflow json'),
      {} as never
    )

    // A second, successful load closes the suppression exactly once more.
    await extension!.beforeLoadGraph!({} as never)
    await extension!.afterConfigureGraph!([], {} as never)

    registered.value = 2
    expect(widgetStore.isLocallyDirty(id)).toBe(true)
  })

  it('keeps the suppression open across two overlapping loads until both finish', async () => {
    const { registerAgentPanelExtension } = await import('./agentPanel')
    registerAgentPanelExtension()
    const extension = mocks.capturedExtensions.find(
      (item) => item.name === 'Comfy.AgentPanel'
    )
    const widgetStore = useWidgetValueStore()
    const id = widgetId('graph-a', toNodeId(1), 'value')
    const registered = widgetStore.registerWidget<number>(id, {
      type: 'number',
      value: 1,
      options: {}
    })!

    // Load A and load B both open the suppression (e.g. two rapid tab
    // switches) before either finishes.
    await extension!.beforeLoadGraph!({} as never)
    await extension!.beforeLoadGraph!({} as never)

    // Load A finishes first - success or error, same as here - while load B
    // is still mid-configure. A single boolean would close the shared
    // suppression right here, wrongly exposing B's still-in-flight
    // structural writes as dirty.
    await extension!.afterConfigureGraph!([], {} as never)

    // A structural write made as part of load B's own (still-suppressed)
    // configure must not be marked dirty just because load A already
    // closed out.
    registered.value = 2
    expect(widgetStore.isLocallyDirty(id)).toBe(false)

    // Only once load B also finishes does the suppression actually close.
    await extension!.afterConfigureGraph!([], {} as never)
    registered.value = 3
    expect(widgetStore.isLocallyDirty(id)).toBe(true)
  })

  it('closes the suppression exactly once per load regardless of completion order', async () => {
    const { registerAgentPanelExtension } = await import('./agentPanel')
    registerAgentPanelExtension()
    const extension = mocks.capturedExtensions.find(
      (item) => item.name === 'Comfy.AgentPanel'
    )
    const widgetStore = useWidgetValueStore()
    const id = widgetId('graph-a', toNodeId(1), 'value')
    const registered = widgetStore.registerWidget<number>(id, {
      type: 'number',
      value: 1,
      options: {}
    })!

    // Load A opens, then load B opens; load B (the more recent one) is the
    // one that finishes first this time, and by error rather than success.
    await extension!.beforeLoadGraph!({} as never)
    await extension!.beforeLoadGraph!({} as never)
    await extension!.onGraphLoadError!(new Error('load B failed'), {} as never)

    registered.value = 2
    expect(widgetStore.isLocallyDirty(id)).toBe(false)

    // Load A's own completion is the one that actually returns the depth to
    // zero and closes the suppression.
    await extension!.afterConfigureGraph!([], {} as never)
    registered.value = 3
    expect(widgetStore.isLocallyDirty(id)).toBe(true)
  })

  it('restores a subgraph reference by its locator after graph load', async () => {
    const { registerAgentPanelExtension } = await import('./agentPanel')
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

    expect(notifyMintPortsBeforeGraphLoad).toHaveBeenCalledOnce()
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
  })
})
