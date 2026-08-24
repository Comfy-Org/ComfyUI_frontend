import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import type { Position } from '@e2e/fixtures/types'
import { CANVAS_POSITION_TOLERANCE } from '@e2e/fixtures/helpers/CanvasHelper'
import { toNodeId } from '@/types/nodeId'

const WORKFLOW = 'large-graph-workflow'
const EXPECTED_COUNTS = { nodes: 245, links: 294, reroutes: 0, groups: 0 }

const DRAGGED_NODE_ID = '1'
const SAMPLE_NODE_IDS = ['2', '100', '245']
const TRACKED_NODE_IDS = [DRAGGED_NODE_ID, ...SAMPLE_NODE_IDS]

const DRAG_DELTA = { x: 120, y: 90 }
/** 245 nodes take a while to boot/restore, especially with Vue nodes. */
const LARGE_GRAPH_TIMEOUT = 60_000

type GraphSnapshot = {
  counts: { nodes: number; links: number; reroutes: number; groups: number }
  positions: Record<string, Position>
}

async function snapshotGraph(comfyPage: ComfyPage): Promise<GraphSnapshot> {
  return comfyPage.page.evaluate(
    (ids) => {
      const graph = window.app!.graph
      const positions: Record<string, Position> = {}
      for (const id of ids) {
        const node = graph.getNodeById(id)
        if (!node) throw new Error(`Tracked node ${id} not found`)
        positions[String(id)] = { x: node.pos[0], y: node.pos[1] }
      }
      return {
        counts: {
          nodes: graph.nodes.length,
          links: graph.links.size,
          reroutes: graph.reroutes.size,
          groups: graph.groups.length
        },
        positions
      }
    },
    TRACKED_NODE_IDS.map((id) => toNodeId(id))
  )
}

function expectPositionMatches(
  actual: Position,
  expected: Position,
  label: string
): void {
  expect(Math.abs(actual.x - expected.x), `${label}: x`).toBeLessThan(
    CANVAS_POSITION_TOLERANCE
  )
  expect(Math.abs(actual.y - expected.y), `${label}: y`).toBeLessThan(
    CANVAS_POSITION_TOLERANCE
  )
}

async function dragTrackedNode(comfyPage: ComfyPage): Promise<void> {
  const nodeRef = await comfyPage.nodeOps.getNodeRefById(DRAGGED_NODE_ID)
  const pos = await nodeRef.getPosition()
  // Instant, animation-free centering — a drag issued right after an
  // animated centering grabs coordinates that are already stale.
  await comfyPage.canvasOps.centerViewOn(pos)
  if (comfyPage.isVueNodes) {
    await comfyPage.vueNodes.dragNodeHeaderBy(DRAGGED_NODE_ID, DRAG_DELTA)
  } else {
    await nodeRef.dragBy(DRAG_DELTA)
  }
}

async function verifyReloadPersistence(comfyPage: ComfyPage): Promise<void> {
  await comfyPage.settings.setSetting('Comfy.Workflow.Persist', true)
  await comfyPage.workflow.loadWorkflow(WORKFLOW)
  await expect
    .poll(() => comfyPage.nodeOps.getGraphNodesCount(), {
      message: 'large graph finished loading',
      timeout: LARGE_GRAPH_TIMEOUT
    })
    .toBe(EXPECTED_COUNTS.nodes)

  const before = await snapshotGraph(comfyPage)
  expect(before.counts, 'baseline counts').toEqual(EXPECTED_COUNTS)

  const afterEdit =
    await test.step('Drag one node as a real edit', async () => {
      // The drag itself retries inside toPass — in the dense 245-node layout
      // a single grab can land on an overlapping element and do nothing.
      await expect(async () => {
        await dragTrackedNode(comfyPage)
        const now = await snapshotGraph(comfyPage)
        const original = before.positions[DRAGGED_NODE_ID]
        const moved = now.positions[DRAGGED_NODE_ID]
        expect(
          Math.hypot(moved.x - original.x, moved.y - original.y),
          'drag moved the node'
        ).toBeGreaterThan(CANVAS_POSITION_TOLERANCE)
      }).toPass({ timeout: 20_000 })
      const afterEdit = await snapshotGraph(comfyPage)

      // The draft carrying the drag is what survives F5 — wait for the persist
      // debounce to flush before pulling the rug out.
      // No pre-reload draft wait: the app flushes pending persistence on
      // pagehide (useWorkflowPersistenceV2 registers flushPendingPersistence),
      // so the F5 below is itself the guarantee that the debounced save
      // lands. Waiting on the debounce here is unreliable — background-page
      // timer throttling stalls it under parallel workers and on CI.
      return afterEdit
    })

  await test.step('Reload the page (F5 arm)', async () => {
    await comfyPage.workflow.reloadAndWaitForApp()
    await expect
      .poll(() => comfyPage.nodeOps.getGraphNodesCount(), {
        message: 'autosaved workflow restored after reload',
        timeout: LARGE_GRAPH_TIMEOUT
      })
      .toBe(EXPECTED_COUNTS.nodes)
    if (comfyPage.isVueNodes) {
      await comfyPage.vueNodes.waitForNodes()
    }
  })

  await test.step('Restored graph matches the pre-reload state', async () => {
    const restored = await snapshotGraph(comfyPage)
    expect(restored.counts, 'counts survive reload').toEqual(EXPECTED_COUNTS)
    for (const id of SAMPLE_NODE_IDS) {
      expectPositionMatches(
        restored.positions[id],
        before.positions[id],
        `sampled node ${id} position survives reload`
      )
    }
    expectPositionMatches(
      restored.positions[DRAGGED_NODE_ID],
      afterEdit.positions[DRAGGED_NODE_ID],
      'dragged node keeps its post-drag position'
    )
    await expect(
      comfyPage.toast.toastErrors,
      'no error toasts after restore'
    ).toHaveCount(0)
  })
}

test.describe('Reload persistence smoke', { tag: ['@slow', '@canvas'] }, () => {
  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.canvasOps.resetView()
  })

  test('classic: a 245-node workflow and a fresh edit survive F5', async ({
    comfyPage
  }) => {
    test.setTimeout(180_000)
    await verifyReloadPersistence(comfyPage)
  })

  test(
    'vue: a 245-node workflow and a fresh edit survive F5',
    { tag: '@vue-nodes' },
    async ({ comfyPage }) => {
      // Mounting 245 Vue nodes twice (load + F5 restore) is CPU-bound and
      // several times slower on CI runners than locally.
      test.setTimeout(300_000)
      await verifyReloadPersistence(comfyPage)
    }
  )
})
