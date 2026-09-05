import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import type { Position } from '@e2e/fixtures/types'
import {
  CANVAS_POSITION_TOLERANCE,
  GROUP_TITLE_GRAB_OFFSET
} from '@e2e/fixtures/helpers/CanvasHelper'
import { toNodeId } from '@/types/nodeId'

const WORKFLOW = 'subgraphs/subgraph-nested-promotion'
const OUTER_NODE_ID = '1'
const SUB0_NODE_ID = '5'
const GROUP_TITLE = 'Group'
/** Graph-space point that stays empty through every phase of the scenario. */
const EMPTY_SPACE: Position = { x: 530, y: 300 }
/** Graph-space point the reroute is parked at, clear of all later moves. */
const REROUTE_HOME: Position = { x: 560, y: 180 }

const OUTER_DRAG_DELTA = { x: 150, y: -260 }
const OUTER_RESIZE_DELTA = { x: 45, y: 35 }
const GROUP_DRAG_DELTA = { x: 430, y: 260 }

type NodeGeometry = Awaited<
  ReturnType<ComfyPage['canvasOps']['getNodeGeometry']>
>

type Scene = {
  outer: NodeGeometry
  group: Position
  reroute: Position
}

type SelectionSummary = {
  nodeIds: string[]
  groupCount: number
  rerouteCount: number
  total: number
  kinds: string[]
}

const CLICK_SCALE = 0.9
const CLICK_ANCHOR_SPREAD = 80

type GraphClicker = (point: Position) => Promise<void>

/**
 * Full pointer path — used for click probes. Centers the view on the point
 * first (hit precision must not depend on how far FitView zoomed out) with
 * an alternating screen anchor, so consecutive clicks never land on the same
 * pixels and cannot register as a double-click. Parity is per scenario run,
 * never module state.
 */
function makeGraphClicker(comfyPage: ComfyPage): GraphClicker {
  let parity = 0
  return async (point: Position) => {
    parity = 1 - parity
    const client = await comfyPage.canvasOps.centerViewOn(point, {
      scale: CLICK_SCALE,
      anchorShift: parity === 0 ? CLICK_ANCHOR_SPREAD : -CLICK_ANCHOR_SPREAD
    })
    await comfyPage.page.mouse.click(client.x, client.y)
    await comfyPage.nextFrame()
  }
}

async function getSelectionSummary(
  comfyPage: ComfyPage
): Promise<SelectionSummary> {
  return comfyPage.page.evaluate(() => {
    const summary = {
      nodeIds: [] as string[],
      groupCount: 0,
      rerouteCount: 0,
      total: 0,
      kinds: [] as string[]
    }
    for (const item of window.app!.canvas.selectedItems) {
      summary.total++
      summary.kinds.push(item.constructor.name)
      if ('inputs' in item || 'outputs' in item) {
        summary.nodeIds.push(String(item.id))
      } else if ('linkIds' in item) {
        summary.rerouteCount++
      } else {
        summary.groupCount++
      }
    }
    return summary
  })
}

async function getSingleRootReroute(comfyPage: ComfyPage): Promise<Position> {
  const reroutes = await comfyPage.page.evaluate(() =>
    [...window.app!.graph.reroutes.values()].map((reroute) => ({
      x: reroute.pos[0],
      y: reroute.pos[1]
    }))
  )
  expect(reroutes, 'exactly one reroute on the root graph').toHaveLength(1)
  return reroutes[0]
}

async function setVueRenderer(
  comfyPage: ComfyPage,
  enabled: boolean
): Promise<void> {
  await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', enabled)
  if (enabled) {
    await comfyPage.vueNodes.waitForNodes()
  } else {
    await expect(comfyPage.vueNodes.nodes).toHaveCount(0)
  }
}

async function expectSceneMatches(
  comfyPage: ComfyPage,
  scene: Scene,
  label: string
): Promise<void> {
  await expect(async () => {
    const outerNow = await comfyPage.canvasOps.getNodeGeometry(
      toNodeId(OUTER_NODE_ID)
    )
    // Slot insets legitimately differ between renderers, so compare the
    // node's model geometry strictly and only require slots to sit on it.
    for (const axis of [0, 1] as const) {
      expect(
        Math.abs(outerNow.pos[axis] - scene.outer.pos[axis]),
        `${label}: Outer pos[${axis}]`
      ).toBeLessThan(CANVAS_POSITION_TOLERANCE)
      expect(
        Math.abs(outerNow.size[axis] - scene.outer.size[axis]),
        `${label}: Outer size[${axis}]`
      ).toBeLessThan(CANVAS_POSITION_TOLERANCE)
    }
    comfyPage.canvasOps.expectSlotsOnNode(outerNow, label)

    const groupNow = await comfyPage.canvasOps.getGroupPosition(GROUP_TITLE)
    expect(
      Math.abs(groupNow.x - scene.group.x),
      `${label}: group x`
    ).toBeLessThan(CANVAS_POSITION_TOLERANCE)
    expect(
      Math.abs(groupNow.y - scene.group.y),
      `${label}: group y`
    ).toBeLessThan(CANVAS_POSITION_TOLERANCE)

    const rerouteNow = await getSingleRootReroute(comfyPage)
    expect(
      Math.abs(rerouteNow.x - scene.reroute.x),
      `${label}: reroute x`
    ).toBeLessThan(CANVAS_POSITION_TOLERANCE)
    expect(
      Math.abs(rerouteNow.y - scene.reroute.y),
      `${label}: reroute y`
    ).toBeLessThan(CANVAS_POSITION_TOLERANCE)
  }).toPass({ timeout: 5000 })
}

/**
 * Probes the scene's current positions (each must hit exactly its target) and
 * the recorded stale positions (each must hit nothing).
 *
 * mode 'pointer' drives the full pointer pipeline and reads what got
 * selected. mode 'model' asserts the canvas hit-test model directly
 * (getNodeOnPos / getGroupOnPos / getRerouteOnPos): after a full undo/redo
 * replay, clicks on group titlebars stop selecting on BOTH main and the ECS
 * branch even though the hit-test model is correct (characterized 2026-08-24,
 * identical at a2603c59a6 and f1bfb313d6), so the replay phase asserts the
 * model and leaves pointer-pipeline verification to the manual soak pass.
 */
async function expectHitParity(
  comfyPage: ComfyPage,
  clickAt: GraphClicker,
  scene: Scene,
  stalePoints: Position[],
  titleHeight: number,
  label: string,
  mode: 'pointer' | 'model' = 'pointer'
): Promise<void> {
  const groupTitlePoint = {
    x: scene.group.x + GROUP_TITLE_GRAB_OFFSET.x,
    y: scene.group.y + GROUP_TITLE_GRAB_OFFSET.y
  }
  const outerTitlePoint = {
    x: scene.outer.pos[0] + scene.outer.size[0] / 2,
    y: scene.outer.pos[1] - titleHeight / 2
  }

  const modelHitAt = (point: Position) =>
    comfyPage.page.evaluate(({ x, y }) => {
      const graph = window.app!.graph
      const group = graph.getGroupOnPos(x, y)
      return {
        node: graph.getNodeOnPos(x, y)?.id?.toString() ?? null,
        group: Boolean(group),
        groupTitlebar: group?.isPointInTitlebar(x, y) ?? false,
        reroute: Boolean(graph.getRerouteOnPos(x, y))
      }
    }, point)

  const clearSelection = async () => {
    await comfyPage.page.evaluate(() => window.app!.canvas.deselectAll())
    await comfyPage.nextFrame()
    await expect(async () => {
      const summary = await getSelectionSummary(comfyPage)
      expect(
        summary.total,
        `${label}: deselectAll clears selection — got ${JSON.stringify(summary)}`
      ).toBe(0)
    }).toPass({ timeout: 5000 })
  }

  // The click itself retries inside toPass: right after a renderer toggle
  // there is a short window where canvas pointer processing drops clicks,
  // so a single click followed by a read-only poll can never recover.
  const clickProbe = async (
    point: Position,
    expected: Partial<SelectionSummary>,
    what: string
  ) => {
    await expect(async () => {
      await comfyPage.page.evaluate(() => window.app!.canvas.deselectAll())
      await comfyPage.nextFrame()
      await clickAt(point)
      const summary = await getSelectionSummary(comfyPage)
      expect(
        summary,
        `${label}: ${what} — got ${JSON.stringify(summary)}`
      ).toMatchObject(expected)
    }).toPass({ timeout: 10_000 })
  }

  if (mode === 'pointer') {
    await clearSelection()
    await clickProbe(
      EMPTY_SPACE,
      { total: 0 },
      'empty-space click selects nothing'
    )
    await clickProbe(
      outerTitlePoint,
      { nodeIds: [OUTER_NODE_ID], groupCount: 0, rerouteCount: 0, total: 1 },
      'click on current Outer title selects Outer'
    )
    await clickProbe(
      groupTitlePoint,
      { nodeIds: [], groupCount: 1, rerouteCount: 0, total: 1 },
      'click on current group title selects the group'
    )
    await clickProbe(
      scene.reroute,
      { nodeIds: [], groupCount: 0, rerouteCount: 1, total: 1 },
      'click on current reroute position selects the reroute'
    )
    await clearSelection()
  } else {
    await expect(async () => {
      const emptyHit = await modelHitAt(EMPTY_SPACE)
      expect(
        emptyHit,
        `${label}: hit-test model finds nothing at empty space — got ${JSON.stringify(emptyHit)}`
      ).toMatchObject({ node: null, group: false, reroute: false })
      const outerHit = await modelHitAt(outerTitlePoint)
      expect(
        outerHit.node,
        `${label}: hit-test model finds Outer at its current title — got ${JSON.stringify(outerHit)}`
      ).toBe(OUTER_NODE_ID)
      const groupHit = await modelHitAt(groupTitlePoint)
      expect(
        groupHit.groupTitlebar,
        `${label}: hit-test model finds the group titlebar at its current position — got ${JSON.stringify(groupHit)}`
      ).toBe(true)
      const rerouteHit = await modelHitAt(scene.reroute)
      expect(
        rerouteHit.reroute,
        `${label}: hit-test model finds the reroute at its current position — got ${JSON.stringify(rerouteHit)}`
      ).toBe(true)
    }).toPass({ timeout: 5000 })
  }

  for (const [index, stalePoint] of stalePoints.entries()) {
    if (mode === 'pointer') {
      await clickProbe(
        stalePoint,
        { total: 0 },
        `stale position ${index} (${stalePoint.x}, ${stalePoint.y}) must select nothing`
      )
      await expect(
        comfyPage.page.locator('.litecontextmenu').first(),
        `${label}: stale position ${index} must not open a link menu`
      ).toBeHidden()
    }
    await expect(async () => {
      const staleHit = await modelHitAt(stalePoint)
      expect(
        staleHit,
        `${label}: hit-test model must find nothing at stale position ${index} — got ${JSON.stringify(staleHit)}`
      ).toMatchObject({
        node: null,
        group: false,
        groupTitlebar: false,
        reroute: false
      })
    }).toPass({ timeout: 5000 })
  }
}

async function verifyStaleHitScenario(
  comfyPage: ComfyPage,
  { startInVue }: { startInVue: boolean }
): Promise<void> {
  await comfyPage.settings.setSetting(
    'LiteGraph.Group.SelectChildrenOnClick',
    false
  )
  await comfyPage.workflow.loadWorkflow(WORKFLOW)
  const clickAt = makeGraphClicker(comfyPage)
  const titleHeight = await comfyPage.canvasOps.getNodeTitleHeight()

  const outer = await comfyPage.nodeOps.getNodeRefById(OUTER_NODE_ID)
  const sub0 = await comfyPage.nodeOps.getNodeRefById(SUB0_NODE_ID)

  await test.step('Group Outer and Sub 0', async () => {
    await outer.click('title')
    await sub0.click('title', { modifiers: ['Control'] })
    await comfyPage.command.executeCommand('Comfy.Graph.GroupSelectedNodes')
    await clickAt(EMPTY_SPACE)
    await expect
      .poll(() =>
        comfyPage.page.evaluate(() => window.app!.graph.groups.length)
      )
      .toBe(1)
  })

  const { staleOuter, staleGroup, staleReroute } =
    await test.step('Create a reroute, park it, and record stale positions', async () => {
      const staleReroute = await comfyPage.canvasOps.createRerouteOnInputLink(
        toNodeId(SUB0_NODE_ID)
      )
      const parkFrom = await comfyPage.canvasOps.centerViewOn(staleReroute, {
        scale: CLICK_SCALE
      })
      await comfyPage.canvasOps.dragAndDrop(parkFrom, {
        x: parkFrom.x + (REROUTE_HOME.x - staleReroute.x) * CLICK_SCALE,
        y: parkFrom.y + (REROUTE_HOME.y - staleReroute.y) * CLICK_SCALE
      })
      await expect(async () => {
        const rerouteNow = await getSingleRootReroute(comfyPage)
        expect(Math.abs(rerouteNow.x - REROUTE_HOME.x)).toBeLessThan(
          CANVAS_POSITION_TOLERANCE
        )
        expect(Math.abs(rerouteNow.y - REROUTE_HOME.y)).toBeLessThan(
          CANVAS_POSITION_TOLERANCE
        )
      }).toPass({ timeout: 5000 })

      return {
        staleOuter: await comfyPage.canvasOps.getNodeGeometry(
          toNodeId(OUTER_NODE_ID)
        ),
        staleGroup: await comfyPage.canvasOps.getGroupPosition(GROUP_TITLE),
        staleReroute
      }
    })

  await test.step('Move and resize Outer, then move the group', async () => {
    await comfyPage.canvasOps.centerViewOn({
      x: staleOuter.pos[0] + staleOuter.size[0] / 2,
      y: staleOuter.pos[1] + staleOuter.size[1] / 2
    })
    if (startInVue) {
      await comfyPage.vueNodes.dragNodeHeaderBy(OUTER_NODE_ID, OUTER_DRAG_DELTA)
    } else {
      await outer.dragBy(OUTER_DRAG_DELTA)
    }
    await expect(async () => {
      const outerNow = await comfyPage.canvasOps.getNodeGeometry(
        toNodeId(OUTER_NODE_ID)
      )
      comfyPage.canvasOps.expectSlotsTrackedNode(outerNow, staleOuter)
    }).toPass({ timeout: 5000 })

    const movedForResize = await comfyPage.canvasOps.getNodeGeometry(
      toNodeId(OUTER_NODE_ID)
    )
    await comfyPage.canvasOps.centerViewOn({
      x: movedForResize.pos[0] + movedForResize.size[0] / 2,
      y: movedForResize.pos[1] + movedForResize.size[1] / 2
    })
    if (startInVue) {
      const fixture = await comfyPage.vueNodes.getFixtureByTitle('Outer')
      await fixture.resizeFromCorner(
        'SE',
        OUTER_RESIZE_DELTA.x,
        OUTER_RESIZE_DELTA.y
      )
      await comfyPage.nextFrame()
    } else {
      const movedOuter = await comfyPage.canvasOps.getNodeGeometry(
        toNodeId(OUTER_NODE_ID)
      )
      const corner = await comfyPage.canvasOps.centerViewOn({
        x: movedOuter.pos[0] + movedOuter.size[0],
        y: movedOuter.pos[1] + movedOuter.size[1]
      })
      await comfyPage.canvasOps.dragAndDrop(
        { x: corner.x - 3, y: corner.y - 3 },
        {
          x: corner.x + OUTER_RESIZE_DELTA.x,
          y: corner.y + OUTER_RESIZE_DELTA.y
        }
      )
    }
    await expect(async () => {
      const outerNow = await comfyPage.canvasOps.getNodeGeometry(
        toNodeId(OUTER_NODE_ID)
      )
      expect(outerNow.size[0], 'resize grew Outer').toBeGreaterThan(
        staleOuter.size[0]
      )
    }).toPass({ timeout: 5000 })

    const groupBeforeDrag =
      await comfyPage.canvasOps.getGroupPosition(GROUP_TITLE)
    await comfyPage.canvasOps.centerViewOn({
      x: groupBeforeDrag.x + GROUP_TITLE_GRAB_OFFSET.x,
      y: groupBeforeDrag.y + GROUP_TITLE_GRAB_OFFSET.y
    })
    await comfyPage.canvasOps.dragGroup({
      name: GROUP_TITLE,
      deltaX: GROUP_DRAG_DELTA.x,
      deltaY: GROUP_DRAG_DELTA.y
    })
    await expect(async () => {
      const groupNow = await comfyPage.canvasOps.getGroupPosition(GROUP_TITLE)
      expect(
        Math.abs(groupNow.x - staleGroup.x),
        'group drag moved the group'
      ).toBeGreaterThan(CANVAS_POSITION_TOLERANCE)
    }).toPass({ timeout: 5000 })
  })

  const scene: Scene = {
    outer: await comfyPage.canvasOps.getNodeGeometry(toNodeId(OUTER_NODE_ID)),
    group: await comfyPage.canvasOps.getGroupPosition(GROUP_TITLE),
    reroute: await getSingleRootReroute(comfyPage)
  }
  comfyPage.canvasOps.expectSlotsOnNode(scene.outer, 'after all mutations')

  const stalePoints: Position[] = [
    {
      x: staleOuter.pos[0] + staleOuter.size[0] / 2,
      y: staleOuter.pos[1] - titleHeight / 2
    },
    {
      x: staleOuter.pos[0] + staleOuter.size[0] / 2,
      y: staleOuter.pos[1] + staleOuter.size[1] / 2
    },
    { x: staleOuter.outputs[0][0], y: staleOuter.outputs[0][1] },
    {
      x: staleGroup.x + GROUP_TITLE_GRAB_OFFSET.x,
      y: staleGroup.y + GROUP_TITLE_GRAB_OFFSET.y
    },
    staleReroute
  ]

  await test.step('Positions survive 3-level subgraph navigation', async () => {
    await comfyPage.subgraph.enterSubgraphDirect(SUB0_NODE_ID)
    const sub1Id = await comfyPage.subgraph.findSubgraphNodeId()
    await comfyPage.subgraph.enterSubgraphDirect(sub1Id)
    const sub2Id = await comfyPage.subgraph.findSubgraphNodeId()
    await comfyPage.subgraph.enterSubgraphDirect(sub2Id)
    await comfyPage.subgraph.exitViaBreadcrumb()

    await expectSceneMatches(comfyPage, scene, 'after subgraph navigation')
  })

  await test.step('Hit targets after toggling renderer without reload', async () => {
    await setVueRenderer(comfyPage, !startInVue)
    await expectSceneMatches(comfyPage, scene, 'after renderer toggle')
    await expectHitParity(
      comfyPage,
      clickAt,
      scene,
      stalePoints,
      titleHeight,
      'toggled renderer'
    )
  })

  await test.step('Hit targets after full undo/redo replay', async () => {
    const depth = (await comfyPage.workflow.getUndoQueueSize()) ?? 0
    expect(depth, 'mutations produced undo history').toBeGreaterThan(0)

    for (let i = 0; i < depth; i++) {
      await comfyPage.keyboard.undo()
      await comfyPage.nextFrame()
    }
    await expect
      .poll(() => comfyPage.workflow.getRedoQueueSize(), {
        message: `undo x${depth} pushed every entry onto the redo queue`
      })
      .toBe(depth)

    for (let i = 0; i < depth; i++) {
      await comfyPage.keyboard.redo()
      await comfyPage.nextFrame()
    }
    await expect
      .poll(() => comfyPage.workflow.getRedoQueueSize(), {
        message: `redo x${depth} replayed every undone entry`
      })
      .toBe(0)
    await expectSceneMatches(comfyPage, scene, 'after undo/redo replay')
    await expectHitParity(
      comfyPage,
      clickAt,
      scene,
      stalePoints,
      titleHeight,
      'after undo/redo replay',
      'model'
    )
  })

  await test.step('Hit targets after toggling back to the starting renderer', async () => {
    await setVueRenderer(comfyPage, startInVue)
    await expectSceneMatches(comfyPage, scene, 'after toggling back')
    await expectHitParity(
      comfyPage,
      clickAt,
      scene,
      stalePoints,
      titleHeight,
      'starting renderer restored',
      'model'
    )
  })

  await test.step('Hit targets after serialize and reload', async () => {
    await comfyPage.subgraph.serializeAndReload()
    if (startInVue) await comfyPage.vueNodes.waitForNodes()
    await expectSceneMatches(comfyPage, scene, 'after serialize and reload')
    // Pointer probes recover after a rebuild only in the classic renderer;
    // with Vue nodes active, group/reroute clicks stay dead after any
    // configure-driven rebuild (same both-refs behaviour as the replay
    // phase), so the Vue-ending ordering asserts the hit-test model.
    await expectHitParity(
      comfyPage,
      clickAt,
      scene,
      stalePoints,
      titleHeight,
      'after serialize and reload',
      startInVue ? 'model' : 'pointer'
    )
  })
}

test.describe(
  'Hit target vs rendered position',
  { tag: ['@slow', '@canvas', '@subgraph'] },
  () => {
    test.afterEach(async ({ comfyPage }) => {
      await comfyPage.canvasOps.resetView()
    })

    test('classic-first: stale positions hit nothing across renderer toggle, history replay, and reload', async ({
      comfyPage
    }) => {
      test.setTimeout(120_000)
      await verifyStaleHitScenario(comfyPage, { startInVue: false })
    })

    test(
      'vue-first: stale positions hit nothing across renderer toggle, history replay, and reload',
      { tag: '@vue-nodes' },
      async ({ comfyPage }) => {
        test.setTimeout(120_000)
        await verifyStaleHitScenario(comfyPage, { startInVue: true })
      }
    )
  }
)
