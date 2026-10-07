import { fromPartial } from '@total-typescript/shoehorn'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import type { EffectScope } from 'vue'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { LGraph, Subgraph } from '@/lib/litegraph/src/litegraph'
import type { ISerialisedNode } from '@/lib/litegraph/src/types/serialisation'
import {
  createTestRootGraph,
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { LGraphEventMode } from '@/lib/litegraph/src/types/globalEnums'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type { LoadedComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import type {
  DeploymentCompatibility,
  WorkspaceDeployment
} from '@/platform/workspace/api/workspaceApi'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import type { DeploymentPickState } from '@/platform/workspace/deploymentPickState'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import * as apiModule from '@/scripts/api'

import {
  useDeploymentCompatibility,
  workflowNodeTypes
} from './useDeploymentCompatibility'

vi.mock(import('@/platform/workspace/api/workspaceApi'))

const hoisted = vi.hoisted(() => ({
  rootGraph: undefined as unknown
}))

vi.mock<unknown>(import('@/scripts/app'), () => ({
  app: {
    get rootGraph() {
      return hoisted.rootGraph
    },
    get isGraphReady() {
      return hoisted.rootGraph !== undefined
    }
  }
}))

vi.mock<unknown>(import('@/scripts/api'), () => {
  const target = new EventTarget()
  return {
    api: target,
    __dispatchGraphChanged: () => {
      target.dispatchEvent(new CustomEvent('graphChanged'))
    }
  }
})

const { __dispatchGraphChanged } = apiModule as typeof apiModule & {
  __dispatchGraphChanged: () => void
}

interface FakeNode {
  type: string
  mode?: LGraphEventMode
  isVirtualNode?: boolean
  serializedType?: string
  subgraphNodes?: FakeNode[]
}

function addNodes(target: LGraph | Subgraph, root: LGraph, fakes: FakeNode[]) {
  for (const fake of fakes) {
    if (fake.subgraphNodes) {
      const subgraph = createTestSubgraph({ rootGraph: root })
      addNodes(subgraph, root, fake.subgraphNodes)
      const instance = createTestSubgraphNode(subgraph, { parentGraph: target })
      instance.mode = fake.mode ?? LGraphEventMode.ALWAYS
      target.add(instance)
      continue
    }
    const node = new LGraphNode(fake.type, fake.type)
    node.mode = fake.mode ?? LGraphEventMode.ALWAYS
    node.isVirtualNode = fake.isVirtualNode
    if (fake.serializedType) {
      node.last_serialization = fromPartial<ISerialisedNode>({
        type: fake.serializedType
      })
    }
    target.add(node)
  }
}

function graph(...fakes: FakeNode[]): LGraph {
  const root = createTestRootGraph()
  addNodes(root, root, fakes)
  return root
}

function deployment(id: string): WorkspaceDeployment {
  return {
    deployment_id: id,
    release_id: `r-${id}`,
    status: 'ready',
    created_at: '2026-10-01T00:00:00Z'
  }
}

function ready(deployments: WorkspaceDeployment[]): DeploymentPickState {
  return {
    phase: 'ready',
    deployments,
    pickedDeploymentId: null,
    pickSource: null,
    defaultDeploymentId: null,
    gonePickedDeploymentId: null,
    goneDefaultDeploymentId: null,
    buildsVisible: true
  }
}

const answer: DeploymentCompatibility = {
  deployments: [
    { deployment_id: 'dep-rgthree', missing_node_types: [] },
    {
      deployment_id: 'dep-plain',
      missing_node_types: ['Power Lora Loader (rgthree)']
    },
    { deployment_id: 'dep-building', missing_node_types: [], unknown: true }
  ],
  cloud: { missing_node_types: ['Power Lora Loader (rgthree)'] }
}

function rgthreeWorkflow(): LGraph {
  return graph({ type: 'KSampler' }, { type: 'Power Lora Loader (rgthree)' })
}

let scope: EffectScope

function setup() {
  scope = effectScope()
  return scope.run(() => useDeploymentCompatibility())!
}

const settle = () => new Promise((resolve) => setTimeout(resolve))

describe('workflowNodeTypes', () => {
  it('lists the backend node types once each, subgraphs included', () => {
    const types = workflowNodeTypes(
      graph(
        { type: 'KSampler' },
        { type: 'KSampler' },
        { type: 'Note', isVirtualNode: true },
        { type: 'Muted', mode: LGraphEventMode.NEVER },
        { type: 'Bypassed', mode: LGraphEventMode.BYPASS },
        { type: 'Placeholder', serializedType: 'MissingPack' },
        {
          type: 'subgraph',
          subgraphNodes: [
            { type: 'Power Lora Loader (rgthree)' },
            { type: 'CLIP' }
          ]
        }
      )
    )

    expect(types).toEqual([
      'CLIP',
      'KSampler',
      'MissingPack',
      'Power Lora Loader (rgthree)'
    ])
  })

  it.for([
    { instance: 'muted', mode: LGraphEventMode.NEVER },
    { instance: 'bypassed', mode: LGraphEventMode.BYPASS }
  ])(
    'leaves out the nodes inside a $instance subgraph instance',
    ({ mode }) => {
      const types = workflowNodeTypes(
        graph(
          { type: 'KSampler' },
          {
            type: 'subgraph',
            mode,
            subgraphNodes: [
              { type: 'Power Lora Loader (rgthree)' },
              { type: 'subgraph', subgraphNodes: [{ type: 'CLIP' }] }
            ]
          }
        )
      )

      expect(types).toEqual(['KSampler'])
    }
  )

  it('counts a subgraph once through its live instance when another instance is muted', () => {
    const root = createTestRootGraph()
    const subgraph = createTestSubgraph({ rootGraph: root })
    subgraph.add(new LGraphNode('CLIP', 'CLIP'))
    const muted = createTestSubgraphNode(subgraph, { parentGraph: root })
    muted.mode = LGraphEventMode.NEVER
    root.add(muted)
    root.add(createTestSubgraphNode(subgraph, { parentGraph: root }))
    root.add(createTestSubgraphNode(subgraph, { parentGraph: root }))

    expect(workflowNodeTypes(root)).toEqual(['CLIP'])
  })
})

describe('useDeploymentCompatibility', () => {
  beforeEach(() => {
    hoisted.rootGraph = rgthreeWorkflow()
    Object.assign(useTeamWorkspaceStore(), { workspaceId: 'ws-1' })
    useDeploymentPickStore().state = ready([
      deployment('dep-rgthree'),
      deployment('dep-plain'),
      deployment('dep-building')
    ])
    vi.mocked(workspaceApi.checkDeploymentCompatibility).mockResolvedValue(
      answer
    )
  })

  afterEach(() => {
    scope.stop()
  })

  it('asks once with the workflow node types and marks each deployment and Comfy Cloud', async () => {
    const { markFor } = setup()
    await settle()

    expect(workspaceApi.checkDeploymentCompatibility).toHaveBeenCalledOnce()
    expect(workspaceApi.checkDeploymentCompatibility).toHaveBeenCalledWith(
      'ws-1',
      ['KSampler', 'Power Lora Loader (rgthree)']
    )
    expect(markFor('dep-rgthree')).toEqual({ kind: 'runs' })
    expect(markFor('dep-plain')).toEqual({
      kind: 'missing',
      nodeTypes: ['Power Lora Loader (rgthree)']
    })
    expect(markFor('dep-building')).toEqual({ kind: 'unknown' })
    expect(markFor(null)).toEqual({
      kind: 'missing',
      nodeTypes: ['Power Lora Loader (rgthree)']
    })
    expect(markFor('dep-not-in-answer')).toBeNull()
  })

  it.for([
    {
      when: 'the switcher is hidden',
      state: { phase: 'hidden' } satisfies DeploymentPickState,
      rootGraph: rgthreeWorkflow
    },
    {
      when: 'the workspace has no deployments',
      state: ready([]),
      rootGraph: rgthreeWorkflow
    },
    {
      when: 'the workflow is empty',
      state: ready([deployment('dep-rgthree')]),
      rootGraph: () => graph()
    },
    {
      when: 'the graph is not ready',
      state: ready([deployment('dep-rgthree')]),
      rootGraph: () => undefined
    }
  ])('sends nothing and marks nothing when $when', async (scenario) => {
    useDeploymentPickStore().state = scenario.state
    hoisted.rootGraph = scenario.rootGraph()

    const { markFor } = setup()
    await settle()

    expect(workspaceApi.checkDeploymentCompatibility).not.toHaveBeenCalled()
    expect(markFor(null)).toBeNull()
  })

  it('marks nothing when the check fails', async () => {
    vi.mocked(workspaceApi.checkDeploymentCompatibility).mockRejectedValue(
      new Error('404')
    )

    const { markFor } = setup()
    await settle()

    expect(markFor('dep-rgthree')).toBeNull()
    expect(markFor(null)).toBeNull()
  })

  it('does not ask again when an edit keeps the same node types', async () => {
    setup()
    await settle()

    hoisted.rootGraph = graph(
      { type: 'Power Lora Loader (rgthree)' },
      { type: 'KSampler' },
      { type: 'KSampler' }
    )
    __dispatchGraphChanged()
    await settle()

    expect(workspaceApi.checkDeploymentCompatibility).toHaveBeenCalledOnce()
  })

  it('asks again when another workflow opens, and drops the old marks until it answers', async () => {
    const { markFor } = setup()
    await settle()
    expect(markFor('dep-plain')).toEqual({
      kind: 'missing',
      nodeTypes: ['Power Lora Loader (rgthree)']
    })

    let answerCoreOnly!: (value: DeploymentCompatibility) => void
    vi.mocked(workspaceApi.checkDeploymentCompatibility).mockReturnValue(
      new Promise((resolve) => {
        answerCoreOnly = resolve
      })
    )
    hoisted.rootGraph = graph({ type: 'KSampler' })
    useWorkflowStore().activeWorkflow = fromPartial<LoadedComfyWorkflow>({
      path: 'workflows/core-only.json'
    })
    await settle()

    expect(workspaceApi.checkDeploymentCompatibility).toHaveBeenLastCalledWith(
      'ws-1',
      ['KSampler']
    )
    expect(markFor('dep-plain')).toBeNull()

    answerCoreOnly({
      deployments: [{ deployment_id: 'dep-plain', missing_node_types: [] }],
      cloud: { missing_node_types: [] }
    })
    await settle()

    expect(markFor('dep-plain')).toEqual({ kind: 'runs' })
    expect(markFor(null)).toEqual({ kind: 'runs' })
  })

  it('ignores an answer for node types the workflow no longer has', async () => {
    let answerFirst!: (value: DeploymentCompatibility) => void
    vi.mocked(workspaceApi.checkDeploymentCompatibility)
      .mockResolvedValue({
        deployments: [{ deployment_id: 'dep-plain', missing_node_types: [] }],
        cloud: { missing_node_types: [] }
      })
      .mockReturnValueOnce(
        new Promise((resolve) => {
          answerFirst = resolve
        })
      )
    const { markFor } = setup()
    await settle()

    hoisted.rootGraph = graph({ type: 'KSampler' })
    __dispatchGraphChanged()
    await settle()
    answerFirst(answer)
    await settle()

    expect(markFor('dep-plain')).toEqual({ kind: 'runs' })
  })

  it('starts the deployment listing when nothing has loaded it yet', async () => {
    useDeploymentPickStore().state = { phase: 'idle' }
    vi.mocked(workspaceApi.listDeployments).mockResolvedValue({
      items: [deployment('dep-rgthree')],
      builds_visible: true
    })

    setup()
    await settle()

    expect(workspaceApi.listDeployments).toHaveBeenCalledWith('ws-1')
    await vi.waitFor(() =>
      expect(workspaceApi.checkDeploymentCompatibility).toHaveBeenCalledOnce()
    )
  })

  it('shares the boot listing instead of asking for a second one', async () => {
    useDeploymentPickStore().state = { phase: 'idle' }
    vi.mocked(workspaceApi.listDeployments).mockResolvedValue({
      items: [deployment('dep-rgthree')],
      builds_visible: true
    })

    const booting = useDeploymentPickStore().loadOnce()
    setup()
    await booting
    await settle()

    expect(workspaceApi.listDeployments).toHaveBeenCalledOnce()
  })
})
