import { fromPartial } from '@total-typescript/shoehorn'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'
import type { EffectScope } from 'vue'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { LGraph, Subgraph } from '@/lib/litegraph/src/litegraph'
import type { ISerialisedNode } from '@/lib/litegraph/src/types/serialisation'
import {
  createTestRootGraph,
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { LGraphEventMode } from '@/lib/litegraph/src/types/globalEnums'
import { reportError } from '@/platform/telemetry/reportError'
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
import { graphToPrompt } from '@/utils/executionUtil'

import {
  useDeploymentCompatibility,
  workflowNodeTypes
} from './useDeploymentCompatibility'

vi.mock(import('@/composables/useFeatureFlags'))
vi.mock(import('@/platform/workspace/api/workspaceApi'))
vi.mock(import('@/platform/telemetry/reportError'))

const hoisted = vi.hoisted(() => ({
  rootGraph: undefined as unknown,
  rootGraphReads: 0
}))

vi.mock<unknown>(import('@/scripts/app'), () => ({
  app: {
    get rootGraph() {
      hoisted.rootGraphReads++
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
  comfyClass?: string
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
    node.comfyClass = fake.comfyClass ?? fake.type
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
    { deployment_id: 'dep-rgthree', missing_node_types: [], unknown: false },
    {
      deployment_id: 'dep-plain',
      missing_node_types: ['Power Lora Loader (rgthree)'],
      unknown: false
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

  it.for<{ name: string; build: () => LGraph; expected: string[] }>([
    {
      name: 'a muted subgraph instance at the root',
      build: () =>
        graph(
          { type: 'KSampler' },
          {
            type: 'subgraph',
            mode: LGraphEventMode.NEVER,
            subgraphNodes: [
              { type: 'Power Lora Loader (rgthree)' },
              { type: 'subgraph', subgraphNodes: [{ type: 'CLIP' }] }
            ]
          }
        ),
      expected: ['KSampler']
    },
    {
      name: 'a bypassed subgraph instance at the root',
      build: () =>
        graph(
          { type: 'KSampler' },
          {
            type: 'subgraph',
            mode: LGraphEventMode.BYPASS,
            subgraphNodes: [{ type: 'Power Lora Loader (rgthree)' }]
          }
        ),
      expected: ['KSampler']
    },
    {
      name: 'a muted subgraph instance inside a live one',
      build: () =>
        graph({
          type: 'subgraph',
          subgraphNodes: [
            { type: 'KSampler' },
            {
              type: 'subgraph',
              mode: LGraphEventMode.NEVER,
              subgraphNodes: [{ type: 'Power Lora Loader (rgthree)' }]
            }
          ]
        }),
      expected: ['KSampler', 'Power Lora Loader (rgthree)']
    },
    {
      name: 'a bypassed subgraph instance inside a live one',
      build: () =>
        graph({
          type: 'subgraph',
          subgraphNodes: [
            { type: 'KSampler' },
            {
              type: 'subgraph',
              mode: LGraphEventMode.BYPASS,
              subgraphNodes: [{ type: 'Power Lora Loader (rgthree)' }]
            }
          ]
        }),
      expected: ['KSampler', 'Power Lora Loader (rgthree)']
    },
    {
      name: 'muted and bypassed nodes at the root',
      build: () =>
        graph(
          { type: 'KSampler' },
          { type: 'Power Lora Loader (rgthree)', mode: LGraphEventMode.NEVER },
          { type: 'CLIP', mode: LGraphEventMode.BYPASS }
        ),
      expected: ['KSampler']
    },
    {
      name: 'muted and bypassed nodes inside a subgraph',
      build: () =>
        graph({
          type: 'subgraph',
          subgraphNodes: [
            { type: 'KSampler' },
            {
              type: 'Power Lora Loader (rgthree)',
              mode: LGraphEventMode.NEVER
            },
            { type: 'CLIP', mode: LGraphEventMode.BYPASS }
          ]
        }),
      expected: ['KSampler']
    },
    {
      name: 'one subgraph used by a muted and a live instance',
      build: () => {
        const root = graph({ type: 'KSampler' })
        const subgraph = createTestSubgraph({ rootGraph: root })
        addNodes(subgraph, root, [{ type: 'CLIP' }])
        const muted = createTestSubgraphNode(subgraph, { parentGraph: root })
        muted.mode = LGraphEventMode.NEVER
        root.add(muted)
        root.add(createTestSubgraphNode(subgraph, { parentGraph: root }))
        return root
      },
      expected: ['CLIP', 'KSampler']
    },
    {
      name: 'a node whose backend class differs from its registry type',
      build: () =>
        graph(
          { type: 'KSampler' },
          { type: 'registry/CustomLoader', comfyClass: 'CustomLoader' }
        ),
      expected: ['CustomLoader', 'KSampler']
    }
  ])('lists what the prompt sends for $name', async ({ build, expected }) => {
    const root = build()
    const { output } = await graphToPrompt(root)
    const sent = [
      ...new Set(Object.values(output).map((node) => node.class_type))
    ].sort()

    expect(sent).toEqual(expected)
    expect(workflowNodeTypes(root)).toEqual(sent)
  })
})

describe('useDeploymentCompatibility', () => {
  beforeEach(() => {
    vi.mocked(useFeatureFlags().flags).deploymentCompatibilityMarksEnabled =
      true
    hoisted.rootGraph = rgthreeWorkflow()
    hoisted.rootGraphReads = 0
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
    await vi.waitFor(() =>
      expect(markFor('dep-rgthree')).toEqual({ kind: 'runs' })
    )

    expect(workspaceApi.checkDeploymentCompatibility).toHaveBeenCalledOnce()
    expect(workspaceApi.checkDeploymentCompatibility).toHaveBeenCalledWith(
      'ws-1',
      ['KSampler', 'Power Lora Loader (rgthree)']
    )
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
    await nextTick()

    expect(workspaceApi.checkDeploymentCompatibility).not.toHaveBeenCalled()
    expect(markFor(null)).toBeNull()
  })

  it('reads the graph only once a check can be sent', async () => {
    vi.useFakeTimers()
    useDeploymentPickStore().state = { phase: 'hidden' }

    setup()
    __dispatchGraphChanged()
    await vi.advanceTimersByTimeAsync(200)
    expect(hoisted.rootGraphReads).toBe(0)

    useDeploymentPickStore().state = ready([deployment('dep-rgthree')])
    await nextTick()

    expect(workspaceApi.checkDeploymentCompatibility).toHaveBeenCalledWith(
      'ws-1',
      ['KSampler', 'Power Lora Loader (rgthree)']
    )
  })

  it('marks nothing and reports once when two checks fail', async () => {
    vi.useFakeTimers()
    const firstFailure = Promise.reject(new Error('404'))
    const secondFailure = Promise.reject(new Error('503'))
    vi.mocked(workspaceApi.checkDeploymentCompatibility)
      .mockReturnValueOnce(firstFailure)
      .mockReturnValueOnce(secondFailure)

    const { markFor } = setup()
    await firstFailure.catch(() => {})

    hoisted.rootGraph = graph({ type: 'KSampler' })
    __dispatchGraphChanged()
    await vi.advanceTimersByTimeAsync(200)
    expect(workspaceApi.checkDeploymentCompatibility).toHaveBeenCalledTimes(2)
    await secondFailure.catch(() => {})

    expect(reportError).toHaveBeenCalledOnce()
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({ message: '404' }),
      expect.objectContaining({
        surface: 'workspace',
        errorType: 'deployment_compatibility_check_failure'
      })
    )
    expect(markFor('dep-rgthree')).toBeNull()
    expect(markFor(null)).toBeNull()
  })

  it('does not ask again when an edit keeps the same node types', async () => {
    vi.useFakeTimers()
    setup()
    expect(workspaceApi.checkDeploymentCompatibility).toHaveBeenCalledOnce()

    hoisted.rootGraph = graph(
      { type: 'Power Lora Loader (rgthree)' },
      { type: 'KSampler' },
      { type: 'KSampler' }
    )
    __dispatchGraphChanged()
    await vi.advanceTimersByTimeAsync(200)

    expect(workspaceApi.checkDeploymentCompatibility).toHaveBeenCalledOnce()
  })

  it('does not rebuild the request key when a move or resize keeps the same node types', async () => {
    vi.useFakeTimers()
    setup()
    expect(workspaceApi.checkDeploymentCompatibility).toHaveBeenCalledOnce()
    const stringify = vi.spyOn(JSON, 'stringify')

    __dispatchGraphChanged()
    await vi.advanceTimersByTimeAsync(200)
    __dispatchGraphChanged()
    await vi.advanceTimersByTimeAsync(200)

    expect(hoisted.rootGraphReads).toBeGreaterThan(1)
    expect(stringify).not.toHaveBeenCalled()
  })

  it('asks again when another workflow opens, and drops the old marks until it answers', async () => {
    const { markFor } = setup()
    await vi.waitFor(() =>
      expect(markFor('dep-plain')).toEqual({
        kind: 'missing',
        nodeTypes: ['Power Lora Loader (rgthree)']
      })
    )

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
    await nextTick()

    expect(workspaceApi.checkDeploymentCompatibility).toHaveBeenLastCalledWith(
      'ws-1',
      ['KSampler']
    )
    expect(markFor('dep-plain')).toBeNull()

    answerCoreOnly({
      deployments: [
        { deployment_id: 'dep-plain', missing_node_types: [], unknown: false }
      ],
      cloud: { missing_node_types: [] }
    })

    await vi.waitFor(() =>
      expect(markFor('dep-plain')).toEqual({ kind: 'runs' })
    )
    expect(markFor(null)).toEqual({ kind: 'runs' })
  })

  it.for([
    {
      change: 'moves to a new Release',
      moved: { ...deployment('dep-building'), release_id: 'r-new' }
    },
    {
      change: 'finishes building',
      moved: { ...deployment('dep-building'), status: 'running' }
    }
  ])(
    'asks again and shows the new answer when a deployment $change',
    async ({ moved }) => {
      const { markFor } = setup()
      await vi.waitFor(() =>
        expect(markFor('dep-building')).toEqual({ kind: 'unknown' })
      )

      vi.mocked(workspaceApi.checkDeploymentCompatibility).mockResolvedValue({
        ...answer,
        deployments: [
          {
            deployment_id: 'dep-building',
            missing_node_types: [],
            unknown: false
          }
        ]
      })
      useDeploymentPickStore().state = ready([
        deployment('dep-rgthree'),
        deployment('dep-plain'),
        moved
      ])

      await vi.waitFor(() =>
        expect(markFor('dep-building')).toEqual({ kind: 'runs' })
      )
      expect(workspaceApi.checkDeploymentCompatibility).toHaveBeenCalledTimes(2)
    }
  )

  it('ignores an answer for node types the workflow no longer has', async () => {
    vi.useFakeTimers()
    let answerFirst!: (value: DeploymentCompatibility) => void
    const firstAnswer = new Promise<DeploymentCompatibility>((resolve) => {
      answerFirst = resolve
    })
    vi.mocked(workspaceApi.checkDeploymentCompatibility)
      .mockResolvedValue({
        deployments: [
          { deployment_id: 'dep-plain', missing_node_types: [], unknown: false }
        ],
        cloud: { missing_node_types: [] }
      })
      .mockReturnValueOnce(firstAnswer)
    const { markFor } = setup()

    hoisted.rootGraph = graph({ type: 'KSampler' })
    __dispatchGraphChanged()
    await vi.advanceTimersByTimeAsync(200)
    expect(markFor('dep-plain')).toEqual({ kind: 'runs' })

    answerFirst(answer)
    await firstAnswer

    expect(markFor('dep-plain')).toEqual({ kind: 'runs' })
  })

  it('keeps the newest answer when an older check of the same workflow answers last', async () => {
    const answers: ((value: DeploymentCompatibility) => void)[] = []
    const checks: Promise<DeploymentCompatibility>[] = []
    vi.mocked(workspaceApi.checkDeploymentCompatibility).mockImplementation(
      () => {
        const check = new Promise<DeploymentCompatibility>((resolve) => {
          answers.push(resolve)
        })
        checks.push(check)
        return check
      }
    )
    const { markFor } = setup()

    hoisted.rootGraph = graph({ type: 'KSampler' })
    useWorkflowStore().activeWorkflow = fromPartial<LoadedComfyWorkflow>({
      path: 'workflows/core-only.json'
    })
    await nextTick()
    hoisted.rootGraph = rgthreeWorkflow()
    useWorkflowStore().activeWorkflow = fromPartial<LoadedComfyWorkflow>({
      path: 'workflows/rgthree.json'
    })
    await nextTick()
    expect(workspaceApi.checkDeploymentCompatibility).toHaveBeenCalledTimes(3)

    answers[2](answer)
    await checks[2]
    expect(markFor('dep-rgthree')).toEqual({ kind: 'runs' })

    answers[0]({
      deployments: [
        { deployment_id: 'dep-rgthree', missing_node_types: [], unknown: true }
      ],
      cloud: { missing_node_types: [] }
    })
    await checks[0]

    expect(markFor('dep-rgthree')).toEqual({ kind: 'runs' })
  })

  it('shows no old marks when a workflow comes back and its new check fails', async () => {
    const { markFor } = setup()
    await vi.waitFor(() =>
      expect(markFor('dep-rgthree')).toEqual({ kind: 'runs' })
    )

    hoisted.rootGraph = graph()
    useWorkflowStore().activeWorkflow = fromPartial<LoadedComfyWorkflow>({
      path: 'workflows/empty.json'
    })
    await nextTick()
    expect(markFor('dep-rgthree')).toBeNull()

    let fail: (error: Error) => void = () => {}
    const failure = new Promise<DeploymentCompatibility>((_, reject) => {
      fail = reject
    })
    vi.mocked(workspaceApi.checkDeploymentCompatibility).mockReturnValueOnce(
      failure
    )
    hoisted.rootGraph = rgthreeWorkflow()
    useWorkflowStore().activeWorkflow = fromPartial<LoadedComfyWorkflow>({
      path: 'workflows/rgthree.json'
    })
    await nextTick()
    expect(workspaceApi.checkDeploymentCompatibility).toHaveBeenCalledTimes(2)
    expect(markFor('dep-rgthree')).toBeNull()
    expect(markFor(null)).toBeNull()

    fail(new Error('503'))
    await failure.catch(() => {})

    expect(markFor('dep-rgthree')).toBeNull()
    expect(markFor(null)).toBeNull()
  })

  it('starts the deployment listing when nothing has loaded it yet', async () => {
    useDeploymentPickStore().state = { phase: 'idle' }
    vi.mocked(workspaceApi.listDeployments).mockResolvedValue({
      items: [deployment('dep-rgthree')],
      builds_visible: true
    })

    setup()

    await vi.waitFor(() =>
      expect(workspaceApi.listDeployments).toHaveBeenCalledWith('ws-1')
    )
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

    await vi.waitFor(() =>
      expect(workspaceApi.checkDeploymentCompatibility).toHaveBeenCalledOnce()
    )
    expect(workspaceApi.listDeployments).toHaveBeenCalledOnce()
  })

  it('loads nothing, asks nothing and marks nothing while its switch is off', async () => {
    vi.mocked(useFeatureFlags().flags).deploymentCompatibilityMarksEnabled =
      false
    useDeploymentPickStore().state = { phase: 'idle' }

    const { markFor } = setup()
    __dispatchGraphChanged()
    await nextTick()

    expect(workspaceApi.listDeployments).not.toHaveBeenCalled()
    expect(workspaceApi.checkDeploymentCompatibility).not.toHaveBeenCalled()
    expect(hoisted.rootGraphReads).toBe(0)
    expect(markFor(null)).toBeNull()
  })

  it('drops the marks when its switch turns off mid-session', async () => {
    const { markFor } = setup()
    await vi.waitFor(() =>
      expect(markFor('dep-rgthree')).toEqual({ kind: 'runs' })
    )

    vi.mocked(useFeatureFlags().flags).deploymentCompatibilityMarksEnabled =
      false
    await nextTick()

    expect(markFor('dep-rgthree')).toBeNull()
    expect(markFor(null)).toBeNull()
  })
})
