import {
  assert,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi
} from 'vitest'
import { ref } from 'vue'

vi.mock(import('@vueuse/router'), () => ({ useRouteHash: () => ref('') }))
vi.mock(import('@comfyorg/telemetry'))
vi.mock(import('@/scripts/api'))
vi.mock(import('@/scripts/app'))
vi.mock(import('@/services/dialogService'))

import {
  bindCanvasTracker,
  resetCanvasTrackerForTest
} from '@/platform/workflow/core/canvasTrackerOwnership'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import {
  createTestSubgraphData,
  createTestSubgraphNode
} from '@comfyorg/litegraph/subgraph/__fixtures__/subgraphHelpers'
import { useSettingStore } from '@/platform/settings/settingStore'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useSubgraphStore } from '@/stores/subgraphStore'
import { ChangeTracker } from '@/scripts/changeTracker'

function putBlueprintOnCanvas() {
  const graph = app.rootGraph
  graph.clear()
  const subgraph = graph.createSubgraph(
    createTestSubgraphData({ name: 'mine' })
  )
  graph.add(createTestSubgraphNode(subgraph))
  return JSON.stringify(graph.serialize())
}

describe('subgraph blueprint save on the canvas', () => {
  let stored = ''

  beforeEach(() => {
    useWorkflowStore().provideChangeTracker(ChangeTracker)
    stored = putBlueprintOnCanvas()
    resetCanvasTrackerForTest()
    onTestFinished(resetCanvasTrackerForTest)
    useSettingStore().settingValues['Comfy.Workflow.WarnBlueprintOverwrite'] =
      false
    vi.mocked(api.listUserDataFullInfo).mockResolvedValue([
      { path: 'mine.json', modified: 1, size: 1 }
    ])
    vi.mocked(api.getGlobalSubgraphs).mockResolvedValue({})
    vi.mocked(api.getUserData).mockImplementation(
      async () => new Response(stored, { status: 200 })
    )
    vi.mocked(api.storeUserData).mockImplementation(async (_p, data) => {
      stored = String(data)
      return Response.json({
        path: 'subgraphs/mine.json',
        modified: Date.now(),
        size: 2
      })
    })
  })

  async function openBlueprintOnCanvas() {
    await useSubgraphStore().fetchSubgraphs()
    const workflowStore = useWorkflowStore()
    const stored = workflowStore.getWorkflowByPath('subgraphs/mine.json')
    assert(stored, 'blueprint is in the workflow list')
    const blueprint = await stored.load()
    blueprint.adoptGraph(app.rootGraph)
    workflowStore.activeWorkflow = blueprint
    bindCanvasTracker(blueprint.changeTracker)
    return blueprint
  }

  function activeTracker() {
    const active = useWorkflowStore().activeWorkflow
    assert(active, 'a workflow is active')
    return active.changeTracker
  }

  type OpenBlueprint = Awaited<ReturnType<typeof openBlueprintOnCanvas>>

  it.for([
    { name: 'save', persist: (blueprint: OpenBlueprint) => blueprint.save() },
    {
      name: 'saveAs',
      persist: (blueprint: OpenBlueprint) =>
        blueprint.saveAs('subgraphs/renamed.json')
    }
  ])(
    'keeps capturing canvas edits on a blueprint tab after $name',
    async ({ persist }) => {
      const blueprint = await openBlueprintOnCanvas()

      await persist(blueprint)
      app.rootGraph.nodes[0].pos = [40, 60]
      activeTracker().captureCanvasState()

      expect(activeTracker().activeState.nodes[0].pos).toEqual([40, 60])
    }
  )

  it('keeps the blueprint name on the canvas tab after saveAs', async () => {
    const blueprint = await openBlueprintOnCanvas()

    await blueprint.saveAs('subgraphs/renamed.json')
    activeTracker().captureCanvasState()

    expect(activeTracker().activeState.definitions?.subgraphs[0].name).toBe(
      'mine'
    )
  })
})
