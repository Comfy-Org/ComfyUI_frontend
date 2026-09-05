import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import type { Position } from '@e2e/fixtures/types'
import { CANVAS_POSITION_TOLERANCE } from '@e2e/fixtures/helpers/CanvasHelper'
import { toNodeId } from '@/types/nodeId'

const WORKFLOW = 'default'
/** SaveImage — terminal node, so deleting it only severs the rerouted link. */
const TARGET_NODE_ID = '9'
const BASE_COUNTS = { nodes: 7, links: 9, reroutes: 0, floating: 0 }
const DANGLING_COUNTS = { nodes: 6, links: 8, reroutes: 1, floating: 1 }
const RESTORED_COUNTS = { nodes: 7, links: 9, reroutes: 1, floating: 0 }

/**
 * QA-style accounting snapshot of the root graph's link/reroute model. Every
 * field is JSON-cloneable so it can cross the evaluate boundary and print
 * whole inside assertion messages.
 */
type GraphProbe = {
  targetExists: boolean
  nodeCount: number
  linkCount: number
  rerouteCount: number
  floatingCount: number
  /** Reroute linkIds that are not in graph.links — orphan references. */
  deadRerouteLinkRefs: string[]
  /** Reroute floatingLinkIds that are not in graph.floatingLinks. */
  deadRerouteFloatingRefs: string[]
  /** Reroutes with totalLinks === 0 — fully dead but still registered. */
  fullyOrphanedRerouteIds: string[]
  /** Floating links whose parentId points at a missing reroute. */
  unparentedFloatingLinkIds: string[]
  /** Live or floating links still referencing the deleted target node. */
  linksReferencingTarget: string[]
  reroutePositions: Position[]
  rerouteLinkIds: string[]
  targetInputLinkId: string | null
}

async function probeGraph(comfyPage: ComfyPage): Promise<GraphProbe> {
  return comfyPage.page.evaluate((targetId) => {
    const graph = window.app!.graph
    const liveLinkIds = new Set([...graph.links.keys()].map(String))
    const floatingLinkIds = new Set([...graph.floatingLinks.keys()].map(String))
    const rerouteIds = new Set([...graph.reroutes.keys()].map(String))

    const deadRerouteLinkRefs: string[] = []
    const deadRerouteFloatingRefs: string[] = []
    const fullyOrphanedRerouteIds: string[] = []
    const reroutePositions: Position[] = []
    const rerouteLinkIds: string[] = []
    for (const reroute of graph.reroutes.values()) {
      reroutePositions.push({ x: reroute.pos[0], y: reroute.pos[1] })
      for (const id of reroute.linkIds) {
        rerouteLinkIds.push(String(id))
        if (!liveLinkIds.has(String(id))) {
          deadRerouteLinkRefs.push(`reroute ${reroute.id} -> link ${id}`)
        }
      }
      for (const id of reroute.floatingLinkIds) {
        if (!floatingLinkIds.has(String(id))) {
          deadRerouteFloatingRefs.push(
            `reroute ${reroute.id} -> floating link ${id}`
          )
        }
      }
      if (reroute.totalLinks === 0) {
        fullyOrphanedRerouteIds.push(String(reroute.id))
      }
    }

    const unparentedFloatingLinkIds: string[] = []
    for (const link of graph.floatingLinks.values()) {
      if (link.parentId != null && !rerouteIds.has(String(link.parentId))) {
        unparentedFloatingLinkIds.push(String(link.id))
      }
    }

    const linksReferencingTarget: string[] = []
    for (const link of [
      ...graph.links.values(),
      ...graph.floatingLinks.values()
    ]) {
      if (
        String(link.origin_id) === String(targetId) ||
        String(link.target_id) === String(targetId)
      ) {
        linksReferencingTarget.push(String(link.id))
      }
    }

    const targetNode = graph.getNodeById(targetId)
    const targetInputLink = targetNode?.inputs?.[0]?.link
    return {
      targetExists: !!targetNode,
      nodeCount: graph.nodes.length,
      linkCount: graph.links.size,
      rerouteCount: graph.reroutes.size,
      floatingCount: graph.floatingLinks.size,
      deadRerouteLinkRefs,
      deadRerouteFloatingRefs,
      fullyOrphanedRerouteIds,
      unparentedFloatingLinkIds,
      linksReferencingTarget,
      reroutePositions,
      rerouteLinkIds,
      targetInputLinkId:
        targetInputLink != null ? String(targetInputLink) : null
    }
  }, toNodeId(TARGET_NODE_ID))
}

function counts(probe: GraphProbe) {
  return {
    nodes: probe.nodeCount,
    links: probe.linkCount,
    reroutes: probe.rerouteCount,
    floating: probe.floatingCount
  }
}

function expectNoOrphans(probe: GraphProbe, label: string): void {
  expect(
    probe.deadRerouteLinkRefs,
    `${label}: every reroute linkId must reference a live link`
  ).toEqual([])
  expect(
    probe.deadRerouteFloatingRefs,
    `${label}: every reroute floatingLinkId must reference a floating link`
  ).toEqual([])
  expect(
    probe.fullyOrphanedRerouteIds,
    `${label}: no reroute may survive with zero links`
  ).toEqual([])
  expect(
    probe.unparentedFloatingLinkIds,
    `${label}: every floating link's parentId must reference a reroute`
  ).toEqual([])
}

function expectReroutePreserved(
  probe: GraphProbe,
  expected: Position,
  label: string
): void {
  expect(probe.reroutePositions, `${label}: exactly one reroute`).toHaveLength(
    1
  )
  const [pos] = probe.reroutePositions
  expect(Math.abs(pos.x - expected.x), `${label}: reroute x`).toBeLessThan(
    CANVAS_POSITION_TOLERANCE
  )
  expect(Math.abs(pos.y - expected.y), `${label}: reroute y`).toBeLessThan(
    CANVAS_POSITION_TOLERANCE
  )
}

function expectDanglingState(
  probe: GraphProbe,
  reroutePos: Position,
  label: string
): void {
  expect(probe.targetExists, `${label}: target node stays deleted`).toBe(false)
  expect(counts(probe), `${label}: graph accounting`).toEqual(DANGLING_COUNTS)
  expect(
    probe.linksReferencingTarget,
    `${label}: no link may reference the deleted node`
  ).toEqual([])
  expectNoOrphans(probe, label)
  expectReroutePreserved(probe, reroutePos, label)
}

async function verifyRerouteAccountingOnTargetDelete(
  comfyPage: ComfyPage
): Promise<void> {
  await comfyPage.workflow.loadWorkflow(WORKFLOW)

  const baseline = await probeGraph(comfyPage)
  expect(counts(baseline), 'baseline graph accounting').toEqual(BASE_COUNTS)

  // Pull the target node away from the dense default layout so the link
  // midpoint is bare canvas — in Vue mode a node's DOM would otherwise
  // swallow the Alt+click before it reaches the canvas.
  await test.step('Expose the target input link', async () => {
    await comfyPage.page.evaluate((targetNodeId) => {
      const node = window.app!.graph.getNodeById(targetNodeId)
      if (!node) throw new Error(`Node ${targetNodeId} not found`)
      node.pos = [node.pos[0] + 320, node.pos[1] + 260]
      window.app!.canvas.setDirty(true, true)
    }, toNodeId(TARGET_NODE_ID))
    await comfyPage.nextFrame()
  })

  const reroutePos =
    await test.step('Create a reroute on the target input link', async () => {
      await comfyPage.canvasOps.createRerouteOnInputLink(
        toNodeId(TARGET_NODE_ID)
      )
      const created = await probeGraph(comfyPage)
      expect(created.reroutePositions).toHaveLength(1)
      const reroutePos = created.reroutePositions[0]
      const probe = await probeGraph(comfyPage)
      expect(counts(probe), 'after reroute creation').toEqual({
        ...BASE_COUNTS,
        reroutes: 1
      })
      expectNoOrphans(probe, 'after reroute creation')
      expect(probe.targetInputLinkId, 'link into the target survives').not.toBe(
        null
      )
      expect(
        probe.rerouteLinkIds,
        'the reroute carries exactly the target input link'
      ).toEqual([probe.targetInputLinkId])
      return reroutePos
    })

  await test.step('Delete the link target node via title click + Delete', async () => {
    const targetNode = await comfyPage.nodeOps.getNodeRefById(TARGET_NODE_ID)
    await targetNode.centerOnNode()
    // Select + Delete retry as a unit: a dropped keystroke cannot be
    // repaired by a read-only poll, and re-selecting an already-deleted
    // node is guarded by the existence check.
    await expect(async () => {
      if (await targetNode.exists()) {
        await targetNode.click('title')
        await comfyPage.keyboard.delete()
        await comfyPage.nextFrame()
      }
      expect(
        await targetNode.exists(),
        'target node deleted via title click + Delete'
      ).toBe(false)
    }).toPass({ timeout: 15_000 })

    await expect(async () => {
      const probe = await probeGraph(comfyPage)
      expectDanglingState(probe, reroutePos, 'after target delete')
    }).toPass({ timeout: 10_000 })
  })

  await test.step('Undo restores node, link, and reroute together', async () => {
    await comfyPage.keyboard.undo()
    await expect(async () => {
      const probe = await probeGraph(comfyPage)
      expect(probe.targetExists, 'undo: target node returns').toBe(true)
      expect(counts(probe), 'undo: graph accounting').toEqual(RESTORED_COUNTS)
      expectNoOrphans(probe, 'undo')
      expect(
        probe.targetInputLinkId,
        'undo: target input link returns'
      ).not.toBe(null)
      expect(
        probe.rerouteLinkIds,
        'undo: the reroute rides the restored link'
      ).toEqual([probe.targetInputLinkId])
      expectReroutePreserved(probe, reroutePos, 'undo')
    }).toPass({ timeout: 10_000 })
  })

  await test.step('Redo returns to the dangling state', async () => {
    await comfyPage.keyboard.redo()
    await expect(async () => {
      const probe = await probeGraph(comfyPage)
      expectDanglingState(probe, reroutePos, 'after redo')
    }).toPass({ timeout: 10_000 })
  })

  await test.step('Serialize and reload resurrects no orphans', async () => {
    await comfyPage.subgraph.serializeAndReload()
    await expect(async () => {
      const probe = await probeGraph(comfyPage)
      expectDanglingState(probe, reroutePos, 'after serialize and reload')
    }).toPass({ timeout: 10_000 })
  })
}

test.describe(
  'Reroute accounting when its link target is deleted',
  { tag: ['@canvas', '@node'] },
  () => {
    test.slow()

    test.afterEach(async ({ comfyPage }) => {
      await comfyPage.canvasOps.resetView()
    })

    test('classic: deleting the target leaves consistent reroute/floating-link accounting through undo, redo, and reload', async ({
      comfyPage
    }) => {
      await verifyRerouteAccountingOnTargetDelete(comfyPage)
    })

    test(
      'vue: deleting the target leaves consistent reroute/floating-link accounting through undo, redo, and reload',
      { tag: '@vue-nodes' },
      async ({ comfyPage }) => {
        await verifyRerouteAccountingOnTargetDelete(comfyPage)
      }
    )
  }
)
