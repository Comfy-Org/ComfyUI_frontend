import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
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
import type { LoadedComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import { useSettingStore } from '@/platform/settings/settingStore'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useSubgraphStore } from '@/stores/subgraphStore'

const fileState = {
  id: '11111111-1111-4111-8111-111111111111',
  last_node_id: 1,
  last_link_id: 0,
  nodes: [
    {
      id: 1,
      type: 'sg-1',
      title: 'mine',
      pos: [0, 0],
      size: [100, 50],
      flags: {},
      order: 0,
      mode: 0,
      inputs: [],
      outputs: [],
      properties: {}
    }
  ],
  links: [],
  groups: [],
  config: {},
  extra: { description: 'saved desc' },
  version: 0.4,
  definitions: {
    subgraphs: [
      {
        id: 'sg-1',
        name: 'mine',
        version: 1,
        state: {
          lastGroupId: 0,
          lastNodeId: 0,
          lastLinkId: 0,
          lastRerouteId: 0
        },
        revision: 0,
        config: {},
        inputNode: { id: -10, bounding: [0, 0, 10, 10] },
        outputNode: { id: -20, bounding: [0, 0, 10, 10] },
        inputs: [],
        outputs: [],
        widgets: [],
        nodes: [],
        links: [],
        groups: [],
        extra: {}
      }
    ]
  }
}

describe('subgraph blueprint save on the canvas', () => {
  let stored = JSON.stringify(fileState)

  beforeEach(() => {
    stored = JSON.stringify(fileState)
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

  it('keeps capturing canvas edits on a blueprint tab after it is saved', async () => {
    await useSubgraphStore().fetchSubgraphs()
    const workflowStore = useWorkflowStore()
    const blueprint = workflowStore.getWorkflowByPath('subgraphs/mine.json')!
    workflowStore.activeWorkflow = blueprint as LoadedComfyWorkflow
    bindCanvasTracker(blueprint.changeTracker!)
    const canvas = JSON.parse(JSON.stringify(blueprint.activeState!))
    vi.spyOn(app.rootGraph, 'serialize').mockImplementation(
      () => JSON.parse(JSON.stringify(canvas)) as never
    )

    await blueprint.save()
    canvas.definitions.subgraphs[0].revision = 8
    workflowStore.activeWorkflow.changeTracker.captureCanvasState()

    expect(
      workflowStore.activeWorkflow.activeState.definitions!.subgraphs[0]
        .revision
    ).toBe(8)
  })
})
