import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import type { Position } from '@e2e/fixtures/types'

/**
 * Soak scenario S2: two workflows open in separate tabs — undo history must
 * bind to the workflow it belongs to, never to "whatever graph is current".
 *
 * Workflow A is the default template; workflow B is a subgraph fixture opened
 * in a second tab. Every mutation goes through the real UI path (header drags,
 * widget inputs, title-click + Delete) because programmatic graph mutation
 * checkpoints differently and breaks undo/redo round-trips. Verification goes
 * through the graph model, which is robust in both renderers — especially
 * after configure-driven rebuilds, where canvas pointer clicks can be dead.
 */

const WORKFLOW_B = 'subgraphs/subgraph-three-promoted-widgets'
const WORKFLOW_A = 'default'
const TAB_A = 'default'
const TAB_B = 'subgraph-three-promoted-widgets'

// Workflow A (default template) node ids.
const KSAMPLER_ID = '3'
const CHECKPOINT_ID = '4'
const SAVE_IMAGE_ID = '9'
const EMPTY_LATENT_ID = '5'

// Workflow B: root has a single subgraph host node with promoted widgets
// text/text_1/text_2 valued first/second/third.
const B_HOST_ID = '11'
const B_HOST_TITLE = 'New Subgraph'
const B_INITIAL_TEXT = 'first'
const B_EDITED_TEXT = 'edited-in-b'

const SEED_VALUE = 12345
const A_MOVE_DELTA: Position = { x: 90, y: -60 }
const B_MOVE_DELTA: Position = { x: -80, y: 70 }
const B_SECOND_MOVE_DELTA = { x: -90, y: 70 }
const MIN_DRAG_EFFECT = 30

type GraphSnapshot = {
  nodes: {
    id: string
    type: string
    pos: [number, number]
    size: [number, number]
    widgets: unknown[]
  }[]
  links: string[]
  subgraphCount: number
}

function captureGraphSnapshot(comfyPage: ComfyPage): Promise<GraphSnapshot> {
  return comfyPage.page.evaluate(() => {
    const graph = window.app!.graph
    const round2 = (value: number) => Math.round(value * 100) / 100
    return {
      nodes: graph.nodes
        .map((node) => ({
          id: String(node.id),
          type: String(node.type),
          pos: [round2(node.pos[0]), round2(node.pos[1])] as [number, number],
          size: [round2(node.size[0]), round2(node.size[1])] as [
            number,
            number
          ],
          widgets: (node.widgets ?? []).map(
            (widget) => (widget.value ?? null) as unknown
          )
        }))
        .sort((a, b) => a.id.localeCompare(b.id)),
      links: [...graph.links.values()]
        .map((link) =>
          [
            String(link.origin_id),
            link.origin_slot,
            String(link.target_id),
            link.target_slot
          ].join(':')
        )
        .sort(),
      subgraphCount: graph.subgraphs.size
    }
  })
}

async function nodeExists(
  comfyPage: ComfyPage,
  nodeId: string
): Promise<boolean> {
  const ref = await comfyPage.nodeOps.getNodeRefById(nodeId)
  return ref.exists()
}

async function getWidgetValue(
  comfyPage: ComfyPage,
  nodeId: string,
  widgetName: string
): Promise<unknown> {
  const ref = await comfyPage.nodeOps.getNodeRefById(nodeId)
  const widget = await ref.getWidgetByName(widgetName)
  return widget.getValue()
}

function linkCountReferencing(
  comfyPage: ComfyPage,
  nodeId: string
): Promise<number> {
  return comfyPage.page.evaluate((id) => {
    let count = 0
    for (const link of window.app!.graph.links.values()) {
      if (String(link.origin_id) === id || String(link.target_id) === id) {
        count++
      }
    }
    return count
  }, String(nodeId))
}

async function expectHistorySizes(
  comfyPage: ComfyPage,
  undoSize: number,
  redoSize: number,
  label: string
): Promise<void> {
  await expect
    .poll(() => comfyPage.workflow.getUndoQueueSize(), {
      message: `${label}: undo queue size`,
      timeout: 5000
    })
    .toBe(undoSize)
  await expect
    .poll(() => comfyPage.workflow.getRedoQueueSize(), {
      message: `${label}: redo queue size`,
      timeout: 5000
    })
    .toBe(redoSize)
}

/**
 * Moves a node through the real pointer path: in Vue mode by dragging its DOM
 * header (NodeReference.dragBy only works in classic), in classic by dragging
 * its canvas title. Centers the view first so the drag target is on-screen.
 */
async function dragNodeByHeader(
  comfyPage: ComfyPage,
  nodeId: string,
  title: string,
  delta: Position,
  vue: boolean
): Promise<void> {
  const nodeRef = await comfyPage.nodeOps.getNodeRefById(nodeId)
  await nodeRef.centerOnNode()
  const before = await nodeRef.getPosition()

  if (vue) {
    await comfyPage.vueNodes.dragNodeHeaderBy(nodeId, delta)
  } else {
    await nodeRef.dragBy(delta)
  }
  await comfyPage.nextFrame()

  await expect(async () => {
    const after = await nodeRef.getPosition()
    expect(
      Math.hypot(after.x - before.x, after.y - before.y),
      `${title} drag moved the node`
    ).toBeGreaterThan(MIN_DRAG_EFFECT)
  }).toPass({ timeout: 5000 })
}

async function setSeedWidget(
  comfyPage: ComfyPage,
  vue: boolean
): Promise<void> {
  const ksampler = await comfyPage.nodeOps.getNodeRefById(KSAMPLER_ID)
  await ksampler.centerOnNode()

  if (vue) {
    const seedWidget = comfyPage.vueNodes
      .getWidgetByName('KSampler', 'seed')
      .first()
    const { input } = comfyPage.vueNodes.getInputNumberControls(seedWidget)
    // fill() alone commits the value without creating an undo checkpoint;
    // Enter delivers the commit the way a user does. No pointer click — the
    // widget's drag-scrub overlay intercepts pointer events.
    await input.fill(String(SEED_VALUE))
    await input.press('Enter')
  } else {
    const widget = await ksampler.getWidgetByName('seed')
    await comfyPage.nodeOps.openLegacyWidgetDialog(widget)
    await comfyPage.nodeOps.fillLegacyWidgetDialog(String(SEED_VALUE))
  }

  await expect
    .poll(() => getWidgetValue(comfyPage, KSAMPLER_ID, 'seed'), {
      message: 'seed widget committed through the UI'
    })
    .toBe(SEED_VALUE)
}

async function editPromotedText(comfyPage: ComfyPage): Promise<void> {
  const host = await comfyPage.nodeOps.getNodeRefById(B_HOST_ID)
  await host.centerOnNode()

  // Promoted multiline text widgets render as DOM textareas in the classic
  // renderer; the first one is the promoted `text` widget (guarded by the
  // value assertion). Fall back to the litegraph prompt for canvas-rendered
  // proxies.
  const textarea = comfyPage.page
    .locator('textarea.comfy-multiline-input')
    .first()
  if ((await textarea.count()) > 0) {
    await expect(textarea).toHaveValue(B_INITIAL_TEXT)
    // Real key events, not fill(): the change tracker only checkpoints
    // edits that arrive the way a user types them.
    await textarea.click()
    await comfyPage.page.keyboard.press('ControlOrMeta+a')
    await textarea.pressSequentially(B_EDITED_TEXT)
    await textarea.blur()
  } else {
    const widget = await host.getWidgetByName('text')
    await comfyPage.nodeOps.openLegacyWidgetDialog(widget)
    const dialog = comfyPage.page.locator('.graphdialog')
    await dialog.locator('.value').fill(B_EDITED_TEXT)
    await dialog.getByRole('button', { name: 'OK' }).click()
    await dialog.waitFor({ state: 'hidden' })
  }

  await expect
    .poll(() => getWidgetValue(comfyPage, B_HOST_ID, 'text'), {
      message: 'promoted text widget committed through the UI'
    })
    .toBe(B_EDITED_TEXT)
}

async function deleteNodeViaTitle(
  comfyPage: ComfyPage,
  nodeId: string,
  title: string,
  vue: boolean
): Promise<void> {
  const nodeRef = await comfyPage.nodeOps.getNodeRefById(nodeId)
  await nodeRef.centerOnNode()

  // The select+delete pair retries as a unit — a click can be dropped or
  // land on an overlapping element in a dense layout.
  await expect(async () => {
    if (await nodeExists(comfyPage, nodeId)) {
      if (vue) {
        const fixture = await comfyPage.vueNodes.getFixtureByTitle(title)
        await fixture.title.click()
      } else {
        await nodeRef.click('title')
      }
      await comfyPage.keyboard.delete()
      await comfyPage.nextFrame()
    }
    expect(
      await nodeExists(comfyPage, nodeId),
      `${title} deleted via title click + Delete`
    ).toBe(false)
  }).toPass({ timeout: 15_000 })
}

async function verifyUndoIsolationScenario(
  comfyPage: ComfyPage,
  { vue }: { vue: boolean }
): Promise<void> {
  await comfyPage.settings.setSetting(
    'Comfy.Workflow.WorkflowTabsPosition',
    'Topbar'
  )
  // Tab A is loaded explicitly — the harness's initial graph is not the
  // default template, so its node ids cannot be assumed.
  await comfyPage.workflow.loadWorkflow(WORKFLOW_A)
  const baselineTabCount = await comfyPage.workflow.getOpenWorkflowCount()

  const aInitial = await captureGraphSnapshot(comfyPage)
  if (!vue) {
    const initialSeed = await getWidgetValue(comfyPage, KSAMPLER_ID, 'seed')
    expect(initialSeed, 'test seed differs from the default').not.toBe(
      SEED_VALUE
    )
  }
  expect(
    await linkCountReferencing(comfyPage, SAVE_IMAGE_ID),
    'Save Image starts with one incoming link'
  ).toBe(1)
  await expectHistorySizes(comfyPage, 0, 0, 'A before edits')

  const aPostEdit = await test.step('Make 3 distinct edits in A', async () => {
    await dragNodeByHeader(
      comfyPage,
      CHECKPOINT_ID,
      'Load Checkpoint',
      A_MOVE_DELTA,
      vue
    )
    await expect
      .poll(() => comfyPage.workflow.getUndoQueueSize(), {
        message: 'A after moving Load Checkpoint'
      })
      .toBeGreaterThanOrEqual(1)

    if (vue) {
      // Vue widget edits commit values without checkpointing undo history
      // (pinned below as a test.fail), so the vue arm's second distinct edit
      // is another node move.
      await dragNodeByHeader(
        comfyPage,
        EMPTY_LATENT_ID,
        'Empty Latent Image',
        { x: 60, y: 90 },
        vue
      )
    } else {
      await setSeedWidget(comfyPage, vue)
    }
    await expect
      .poll(() => comfyPage.workflow.getUndoQueueSize(), {
        message: 'A after the second edit'
      })
      .toBeGreaterThanOrEqual(2)

    await deleteNodeViaTitle(comfyPage, SAVE_IMAGE_ID, 'Save Image', vue)
    await expect
      .poll(() => linkCountReferencing(comfyPage, SAVE_IMAGE_ID), {
        message: 'deleting Save Image removed its link'
      })
      .toBe(0)
    // Real UI gestures may checkpoint more than once (a title click can
    // register a micro-move before the delete), so the depth is captured
    // rather than assumed and every later count is relative to it.
    const depth = (await comfyPage.workflow.getUndoQueueSize()) ?? 0
    expect(
      depth,
      'three edits produced at least three entries'
    ).toBeGreaterThanOrEqual(3)

    return { snapshot: await captureGraphSnapshot(comfyPage), depth }
  })

  const aPostEditSnapshot = aPostEdit.snapshot
  const aDepth = aPostEdit.depth

  await test.step('Full undo/redo cycle in A while it is active', async () => {
    for (let i = 0; i < aDepth; i++) {
      await comfyPage.keyboard.undo()
      await comfyPage.nextFrame()
    }
    await expectHistorySizes(comfyPage, 0, aDepth, 'A fully undone')
    await expect
      .poll(() => captureGraphSnapshot(comfyPage), {
        message: 'undoing everything returned A to its initial state'
      })
      .toEqual(aInitial)
    for (let i = 0; i < aDepth; i++) {
      await comfyPage.keyboard.redo()
      await comfyPage.nextFrame()
    }
    await expectHistorySizes(comfyPage, aDepth, 0, 'A fully redone')
    await expect
      .poll(() => captureGraphSnapshot(comfyPage), {
        message: 'redoing everything returned A to its post-edit state'
      })
      .toEqual(aPostEditSnapshot)
  })

  const bPostEdit =
    await test.step('Open B in a second tab and edit it', async () => {
      await comfyPage.workflow.loadWorkflow(WORKFLOW_B)
      await expect
        .poll(() => comfyPage.workflow.getOpenWorkflowCount(), {
          message: 'loading B opened a second workflow tab'
        })
        .toBe(baselineTabCount + 1)
      await expect
        .poll(() => comfyPage.menu.topbar.getTabNames())
        .toEqual(expect.arrayContaining([TAB_A, TAB_B]))
      await expect
        .poll(() => comfyPage.menu.topbar.getActiveTabName())
        .toContain(TAB_B)
      // B carries its own change tracker: nothing of A's history leaks in.
      await expectHistorySizes(comfyPage, 0, 0, 'B starts with empty history')

      await dragNodeByHeader(
        comfyPage,
        B_HOST_ID,
        B_HOST_TITLE,
        B_MOVE_DELTA,
        vue
      )
      await expect
        .poll(() => comfyPage.workflow.getUndoQueueSize(), {
          message: 'B after moving the node'
        })
        .toBeGreaterThanOrEqual(1)

      const afterFirstMove = await captureGraphSnapshot(comfyPage)

      // Second distinct edit. Deliberately another move: editing a promoted
      // text widget updates the value but never checkpoints (pre-existing on
      // both refs — pinned separately below), which would silently starve
      // this scenario of its second undo entry.
      await dragNodeByHeader(
        comfyPage,
        B_HOST_ID,
        B_HOST_TITLE,
        B_SECOND_MOVE_DELTA,
        vue
      )
      await expect
        .poll(() => comfyPage.workflow.getUndoQueueSize(), {
          message: 'B edits produced entries',
          timeout: 10_000
        })
        .toBeGreaterThanOrEqual(2)
      const depth = (await comfyPage.workflow.getUndoQueueSize()) ?? 0

      const snapshot = await captureGraphSnapshot(comfyPage)

      // Undo/redo must be exercised BEFORE ever leaving this tab: on both
      // refs Ctrl+Z is a silent no-op in a tab that was switched away from
      // and back (pinned as a dedicated test.fail below).
      await comfyPage.keyboard.undo()
      await expect
        .poll(() => captureGraphSnapshot(comfyPage), {
          message: "undo in B reverted only B's second move"
        })
        .toEqual(afterFirstMove)
      await expect
        .poll(() => comfyPage.workflow.getRedoQueueSize(), {
          message: 'B after its own undo'
        })
        .toBe(1)
      await comfyPage.keyboard.redo()
      await expect
        .poll(() => captureGraphSnapshot(comfyPage), {
          message: 'redo in B restored the second move'
        })
        .toEqual(snapshot)

      return { snapshot, depth }
    })

  const bPostEditSnapshot = bPostEdit.snapshot
  const bDepth = bPostEdit.depth

  await test.step('Back in A: state is exactly post-edit', async () => {
    await comfyPage.workflow.switchToTab(TAB_A)
    await expect
      .poll(() => captureGraphSnapshot(comfyPage), {
        message: 'A restored exactly to its post-edit state'
      })
      .toEqual(aPostEditSnapshot)
    await expectHistorySizes(
      comfyPage,
      aDepth,
      0,
      'A history intact after opening B'
    )
  })

  await test.step('Undo pressed in A never touches B', async () => {
    // Symmetric undo/redo churn, so the step holds whether or not the
    // pinned tab-return no-op defect is present: while the defect exists
    // all four presses are no-ops; once fixed they round-trip. Either way
    // A ends at its post-edit state and nothing may leak into B.
    await comfyPage.keyboard.undo()
    await comfyPage.keyboard.undo()
    await comfyPage.nextFrame()
    await comfyPage.keyboard.redo()
    await comfyPage.keyboard.redo()
    await comfyPage.nextFrame()

    await comfyPage.workflow.switchToTab(TAB_B)
    await expect
      .poll(() => captureGraphSnapshot(comfyPage), {
        message: "undo pressed in A did not touch B's graph"
      })
      .toEqual(bPostEditSnapshot)
    await expectHistorySizes(
      comfyPage,
      bDepth,
      0,
      "undo in A did not touch B's history"
    )
  })

  await test.step('Undo pressed in B never touches A', async () => {
    // Same symmetric churn as the A-side step, for the same reason.
    await comfyPage.keyboard.undo()
    await comfyPage.nextFrame()
    await comfyPage.keyboard.redo()
    await comfyPage.nextFrame()
    await comfyPage.workflow.switchToTab(TAB_A)
    await expect
      .poll(() => captureGraphSnapshot(comfyPage), {
        message: "undo pressed in B did not touch A's graph"
      })
      .toEqual(aPostEditSnapshot)
    await comfyPage.workflow.switchToTab(TAB_B)
    await expect
      .poll(() => captureGraphSnapshot(comfyPage), {
        message: 'B graph state preserved across the round trip'
      })
      .toEqual(bPostEditSnapshot)
  })

  await test.step('Close B without saving; A keeps its exact state with no residue', async () => {
    await comfyPage.menu.topbar.closeWorkflowTab(TAB_B)
    const closeAnyway = comfyPage.page.getByRole('button', {
      name: 'Close anyway'
    })
    await expect(closeAnyway, 'dirty-close dialog appeared').toBeVisible()
    await closeAnyway.click()
    await comfyPage.workflow.waitForWorkflowIdle()

    await expect
      .poll(() => comfyPage.workflow.getOpenWorkflowCount(), {
        message: 'closing B left a single open workflow'
      })
      .toBe(baselineTabCount)
    await expect
      .poll(() => comfyPage.menu.topbar.getActiveTabName())
      .toContain(TAB_A)
    if (vue) await comfyPage.vueNodes.waitForNodes()

    expect(
      aPostEditSnapshot.subgraphCount,
      'post-edit A must have zero subgraphs for the residue check to mean anything'
    ).toBe(0)
    await expect
      .poll(() => captureGraphSnapshot(comfyPage), {
        message: 'A matches its post-edit state with no leftovers from B'
      })
      .toEqual(aPostEditSnapshot)
    await expectHistorySizes(
      comfyPage,
      aDepth,
      0,
      'A history survives closing B'
    )
  })
}

test.describe(
  'Workflow tab undo isolation',
  { tag: ['@slow', '@canvas'] },
  () => {
    test.slow()

    test.afterEach(async ({ comfyPage }) => {
      await comfyPage.canvasOps.resetView()
    })

    test('classic: undo history binds to its own workflow tab', async ({
      comfyPage
    }) => {
      test.setTimeout(120_000)
      await verifyUndoIsolationScenario(comfyPage, { vue: false })
    })

    // Pre-existing on both merge-base main and the branch (verified
    // 2026-08-24): editing a promoted subgraph text widget updates the value
    // but never creates an undo checkpoint, so Ctrl+Z cannot revert it.
    // Pinned as wanted behaviour; flips to unexpected-pass when fixed.
    test('classic: promoted text edit creates an undo checkpoint', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(WORKFLOW_B)
      const before = (await comfyPage.workflow.getUndoQueueSize()) ?? 0
      await editPromotedText(comfyPage)
      // Armed only after the edit committed, so setup errors fail the test
      // instead of satisfying the pin.
      test.fail()
      await expect
        .poll(() => comfyPage.workflow.getUndoQueueSize(), {
          message: 'text edit must checkpoint',
          timeout: 5000
        })
        .toBeGreaterThan(before)
    })

    // Same checkpoint gap through the Vue number widget: fill/Enter commits
    // the value, undo history never learns about it.
    test(
      'vue: widget edit creates an undo checkpoint',
      { tag: '@vue-nodes' },
      async ({ comfyPage }) => {
        await comfyPage.workflow.loadWorkflow(WORKFLOW_A)
        const before = (await comfyPage.workflow.getUndoQueueSize()) ?? 0
        await setSeedWidget(comfyPage, true)
        test.fail()
        await expect
          .poll(() => comfyPage.workflow.getUndoQueueSize(), {
            message: 'widget edit must checkpoint',
            timeout: 5000
          })
          .toBeGreaterThan(before)
      }
    )

    // Pre-existing on both refs (verified 2026-08-24): after switching to
    // another workflow tab and back, Ctrl+Z in the original tab is a silent
    // no-op — the undo queue stays intact but unreachable. Wanted behaviour
    // pinned; flips to unexpected-pass when fixed.
    test('classic: undo still works after returning to a tab', async ({
      comfyPage
    }) => {
      await comfyPage.settings.setSetting(
        'Comfy.Workflow.WorkflowTabsPosition',
        'Topbar'
      )
      await comfyPage.workflow.loadWorkflow(WORKFLOW_A)
      const save = await comfyPage.nodeOps.getNodeRefById(SAVE_IMAGE_ID)
      await save.centerOnNode()
      await deleteNodeViaTitle(comfyPage, SAVE_IMAGE_ID, 'Save Image', false)
      await comfyPage.workflow.loadWorkflow(WORKFLOW_B)
      await comfyPage.workflow.switchToTab(TAB_A)
      await comfyPage.keyboard.undo()
      test.fail()
      await expect
        .poll(() => nodeExists(comfyPage, SAVE_IMAGE_ID), {
          message: 'undo after tab round-trip restores the deleted node'
        })
        .toBe(true)
    })

    test(
      'vue: undo history binds to its own workflow tab',
      { tag: '@vue-nodes' },
      async ({ comfyPage }) => {
        test.setTimeout(120_000)
        await verifyUndoIsolationScenario(comfyPage, { vue: true })
      }
    )
  }
)
