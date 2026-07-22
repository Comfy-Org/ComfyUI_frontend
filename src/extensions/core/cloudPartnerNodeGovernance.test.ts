import { fromPartial } from '@total-typescript/shoehorn'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  createTestRootGraph,
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { LGraphEventMode } from '@/lib/litegraph/src/types/globalEnums'
import type { ComfyApp } from '@/scripts/app'
import type { QueuePromptGuard } from '@/services/queuePromptGuardService'
import type { ComfyExtension } from '@/types/comfy'
import { createNodeExecutionId } from '@/types/nodeIdentification'

const {
  addToast,
  governanceStore,
  isNodeDisabled,
  loadPolicy,
  registerQueuePromptGuard,
  registerExtension,
  usePartnerNodeGovernanceStore
} = vi.hoisted(() => {
  const isNodeDisabled = vi.fn()
  const loadPolicy = vi.fn<() => Promise<void>>().mockResolvedValue()
  const governanceStore = {
    status: 'configured',
    isNodeDisabled,
    loadPolicy
  }
  return {
    addToast: vi.fn(),
    governanceStore,
    isNodeDisabled,
    loadPolicy,
    registerQueuePromptGuard: vi.fn<
      (id: string, guard: QueuePromptGuard) => () => void
    >(() => () => {}),
    registerExtension: vi.fn<(extension: ComfyExtension) => void>(),
    usePartnerNodeGovernanceStore: vi.fn(() => governanceStore)
  }
})

vi.mock('@/platform/workspace/stores/partnerNodeGovernanceStore', () => ({
  usePartnerNodeGovernanceStore
}))

vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: () => ({ add: addToast })
}))

vi.mock('@/services/queuePromptGuardService', () => ({
  registerQueuePromptGuard
}))

vi.mock('@/services/extensionService', () => ({
  useExtensionService: () => ({ registerExtension })
}))

describe('cloudPartnerNodeGovernance', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.resetModules()
    vi.clearAllMocks()
    governanceStore.status = 'configured'
    loadPolicy.mockResolvedValue()
  })

  async function loadExtension(): Promise<ComfyExtension> {
    await import('./cloudPartnerNodeGovernance')
    const extension = registerExtension.mock.calls[0]?.[0]
    if (!extension)
      throw new Error('Expected governance extension registration')
    return extension
  }

  async function loadGuard(): Promise<QueuePromptGuard> {
    const extension = await loadExtension()
    extension.setup?.(fromPartial<ComfyApp>({}))
    const guard = registerQueuePromptGuard.mock.calls[0]?.[1]
    if (!guard) throw new Error('Expected queue guard registration')
    return guard
  }

  function disabledPartnerNode(): LGraphNode {
    return new LGraphNode('DisabledPartnerNode', 'DisabledPartnerNode')
  }

  function outputNode(title: string): LGraphNode {
    class OutputNode extends LGraphNode {
      static override nodeData = { output_node: true }
    }

    return new OutputNode(title, title)
  }

  function connectNodes(graph: LGraph, source: LGraphNode, target: LGraphNode) {
    source.addOutput('output', '*')
    target.addInput('input', '*')
    graph.add(source)
    graph.add(target)
    source.connect(0, target, 0)
  }

  it('initializes governance during Cloud setup', async () => {
    const extension = await loadExtension()
    expect(extension.name).toBe('Comfy.Cloud.PartnerNodeGovernance')

    extension.setup?.(fromPartial<ComfyApp>({}))

    expect(usePartnerNodeGovernanceStore).toHaveBeenCalledOnce()
    expect(registerQueuePromptGuard).toHaveBeenCalledOnce()
  })

  it('waits for the initial policy load before checking the graph', async () => {
    let resolvePolicy!: () => void
    loadPolicy.mockReturnValue(
      new Promise((resolve) => {
        resolvePolicy = resolve
      })
    )
    governanceStore.status = 'loading'
    const graph = new LGraph()
    graph.add(disabledPartnerNode())
    isNodeDisabled.mockReturnValue(true)
    const guard = await loadGuard()

    const result = guard({ rootGraph: graph })

    expect(loadPolicy).toHaveBeenCalledOnce()
    expect(isNodeDisabled).not.toHaveBeenCalled()
    resolvePolicy()
    await expect(result).resolves.toBe(false)
  })

  it('blocks queueing when the graph contains a disabled partner node', async () => {
    const graph = new LGraph()
    graph.add(disabledPartnerNode())
    isNodeDisabled.mockImplementation(
      (nodeType) => nodeType === 'DisabledPartnerNode'
    )
    const guard = await loadGuard()

    const result = await guard({ rootGraph: graph })

    expect(result).toBe(false)
    expect(isNodeDisabled).toHaveBeenCalledWith('DisabledPartnerNode')
    expect(addToast).toHaveBeenCalledWith({
      severity: 'error',
      summary: 'Workflow blocked by workspace policy',
      detail:
        'Remove disabled partner nodes from this workflow or ask a workspace owner to update the policy.',
      life: 6000
    })
  })

  it.each([
    ['muted', LGraphEventMode.NEVER],
    ['bypassed', LGraphEventMode.BYPASS]
  ])(
    'allows queueing when the disabled partner node is %s',
    async (_label, mode) => {
      const graph = new LGraph()
      const node = disabledPartnerNode()
      node.mode = mode
      graph.add(node)
      isNodeDisabled.mockImplementation(
        (nodeType) => nodeType === 'DisabledPartnerNode'
      )
      const guard = await loadGuard()

      expect(await guard({ rootGraph: graph })).toBe(true)
      expect(addToast).not.toHaveBeenCalled()
    }
  )

  it('allows queueing when the disabled partner node is inside a muted subgraph', async () => {
    const rootGraph = createTestRootGraph()
    const subgraph = createTestSubgraph({ rootGraph })
    subgraph.add(disabledPartnerNode())
    const host = createTestSubgraphNode(subgraph)
    host.mode = LGraphEventMode.NEVER
    rootGraph.add(host)
    isNodeDisabled.mockImplementation(
      (nodeType) => nodeType === 'DisabledPartnerNode'
    )
    const guard = await loadGuard()

    expect(await guard({ rootGraph })).toBe(true)
    expect(addToast).not.toHaveBeenCalled()
  })

  it('blocks queueing when the disabled partner node is inside an active subgraph', async () => {
    const rootGraph = createTestRootGraph()
    const subgraph = createTestSubgraph({ rootGraph })
    subgraph.add(disabledPartnerNode())
    rootGraph.add(createTestSubgraphNode(subgraph))
    isNodeDisabled.mockImplementation(
      (nodeType) => nodeType === 'DisabledPartnerNode'
    )
    const guard = await loadGuard()

    expect(await guard({ rootGraph })).toBe(false)
    expect(isNodeDisabled).toHaveBeenCalledWith('DisabledPartnerNode')
  })

  it('allows partial execution when a disabled node is on another output branch', async () => {
    const graph = new LGraph()
    const allowedSource = new LGraphNode('AllowedNode', 'AllowedNode')
    const allowedOutput = outputNode('AllowedOutput')
    const disabledSource = disabledPartnerNode()
    const unrelatedOutput = outputNode('UnrelatedOutput')
    connectNodes(graph, allowedSource, allowedOutput)
    connectNodes(graph, disabledSource, unrelatedOutput)
    isNodeDisabled.mockImplementation(
      (nodeType) => nodeType === 'DisabledPartnerNode'
    )
    const guard = await loadGuard()

    const result = await guard({
      rootGraph: graph,
      queueNodeIds: [createNodeExecutionId([allowedOutput.id])]
    })

    expect(result).toBe(true)
    expect(addToast).not.toHaveBeenCalled()
  })

  it('blocks partial execution when a disabled node is an upstream dependency', async () => {
    const graph = new LGraph()
    const disabledSource = disabledPartnerNode()
    const selectedOutput = outputNode('SelectedOutput')
    connectNodes(graph, disabledSource, selectedOutput)
    isNodeDisabled.mockImplementation(
      (nodeType) => nodeType === 'DisabledPartnerNode'
    )
    const guard = await loadGuard()

    const result = await guard({
      rootGraph: graph,
      queueNodeIds: [createNodeExecutionId([selectedOutput.id])]
    })

    expect(result).toBe(false)
    expect(isNodeDisabled).toHaveBeenCalledWith('DisabledPartnerNode')
  })
})
