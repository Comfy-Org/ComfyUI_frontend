import { createTestingPinia } from '@pinia/testing'
import { fromAny } from '@total-typescript/shoehorn'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { app } from '@/scripts/app'
import { ChangeTracker } from '@/scripts/changeTracker'
import { toNodeId } from '@/types/nodeId'
import type { WidgetId } from '@/types/widgetId'

import { useAppModeStore } from './appModeStore'

/**
 * Regression coverage for pruning a NON-ACTIVE workflow's linear data.
 *
 * `pruneLinearData` used to resolve every stored id against `app.rootGraph`
 * unconditionally, while `useWorkflowActionsMenu` calls it with
 * `workflow.changeTracker.activeState.extra.linearData` for a workflow that is
 * explicitly NOT the active one — so workflow B's app config got validated
 * against workflow A's graph and dropped.
 */

// Graph A — the graph that is actually loaded in the canvas.
const graphAId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
// Graph B — a different, non-active workflow's graph.
const graphBId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

const widgetInB = `${graphBId}:7:cfg` as WidgetId

vi.mock('@/scripts/app', () => ({
  app: {
    rootGraph: {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      extra: {},
      nodes: [] as LGraphNode[],
      subgraphs: new Map(),
      events: new EventTarget(),
      getNodeById: vi.fn(() => null)
    }
  }
}))

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({ getCanvas: () => ({ state: undefined }) })
}))

vi.mock('@/components/builder/useEmptyWorkflowDialog', () => ({
  useEmptyWorkflowDialog: () => ({ show: vi.fn() })
}))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({ get: vi.fn(() => false), set: vi.fn() })
}))

function nodeWithWidgets(graphId: string, id: number, names: string[]) {
  return fromAny<LGraphNode, unknown>({
    id: toNodeId(id),
    widgets: names.map((name) => ({
      name,
      widgetId: `${graphId}:${id}:${name}` as WidgetId
    }))
  })
}

describe('appModeStore.pruneLinearData — non-active workflow', () => {
  let store: ReturnType<typeof useAppModeStore>

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    ChangeTracker.isLoadingGraph = false

    // Graph A is loaded: it only contains node 1 with a `seed` widget.
    const nodeA = nodeWithWidgets(graphAId, 1, ['seed'])
    vi.mocked(app.rootGraph!).id = graphAId
    vi.mocked(app.rootGraph!).nodes = [nodeA]
    vi.mocked(app.rootGraph!).getNodeById = vi.fn((id) =>
      String(id) === '1' ? nodeA : null
    )

    store = useAppModeStore()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('preserves inputs belonging to another workflow instead of pruning them against the active graph', () => {
    // Workflow B's saved app config: node 7 / widget `cfg` exists in B only.
    const linearDataOfB = {
      inputs: [[widgetInB, 'cfg'] as [WidgetId, string]],
      outputs: [toNodeId(7)]
    }

    const { inputs } = store.pruneLinearData(linearDataOfB)

    expect(inputs).toEqual([[widgetInB, 'cfg']])
  })

  it('preserves outputs belonging to another workflow', () => {
    const linearDataOfB = {
      inputs: [],
      outputs: [toNodeId(7)]
    }

    const { outputs } = store.pruneLinearData(linearDataOfB)

    expect(outputs).toEqual([toNodeId(7)])
  })
})
