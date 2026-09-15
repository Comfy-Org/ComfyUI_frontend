import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'

const LEGACY_EDIT_TITLE = 'KSampler'
const VUE_EDIT_TITLE = 'Load Checkpoint'

/** Graph positions, keyed by node id. Renderer-independent, and exactly what
 * serialization writes — so the same read works in both modes. */
async function getPositions(comfyPage: ComfyPage) {
  return comfyPage.page.evaluate(() =>
    Object.fromEntries(
      window.app!.graph.nodes.map((node) => [String(node.id), [...node.pos]])
    )
  )
}

async function getPosition(comfyPage: ComfyPage, title: string) {
  const node = await comfyPage.nodeOps.getNodeRefByTitle(title)
  return node.getProperty<[number, number]>('pos')
}

/** Toggling renderers can shift a position by a sub-pixel amount, which
 * `rendererToggleStability.spec.ts` already accepts at the same precision.
 * Reserved for comparisons that cross a toggle — the round-trip comparison
 * below uses exact equality, because serialized values must not move at all. */
function expectSamePositionAcrossToggle(
  actual: [number, number],
  expected: [number, number],
  label: string
) {
  expect(actual[0], `${label} x`).toBeCloseTo(expected[0], 1)
  expect(actual[1], `${label} y`).toBeCloseTo(expected[1], 1)
}

/**
 * ECS 1.53 Area 6: build in legacy, toggle to 2.0, edit, toggle back, save,
 * reload — nothing lost in either direction. `rendererToggleStability.spec.ts`
 * toggles five times but never edits between toggles, and nothing in the suite
 * crosses a save/reload after editing in both modes.
 */
test.describe(
  'Renderer toggle round trip',
  { tag: ['@node', '@canvas', '@vue-nodes'] },
  () => {
    test('edits made in each renderer survive the toggle and a round trip', async ({
      comfyPage,
      comfyMouse
    }) => {
      test.slow()
      await comfyPage.menu.topbar.setVueNodesEnabled(false)

      const legacyBefore = await getPosition(comfyPage, LEGACY_EDIT_TITLE)
      const legacyNode =
        await comfyPage.nodeOps.getNodeRefByTitle(LEGACY_EDIT_TITLE)
      await legacyNode.dragBy({ x: 90, y: 60 })
      // Precondition: the legacy edit landed. Without it, "the edit survived"
      // also holds for an edit that never happened.
      const legacyEdited = await getPosition(comfyPage, LEGACY_EDIT_TITLE)
      expect(legacyEdited, 'legacy drag should move the node').not.toEqual(
        legacyBefore
      )

      await comfyPage.menu.topbar.setVueNodesEnabled(true)
      await comfyPage.vueNodes.waitForNodes()
      expectSamePositionAcrossToggle(
        await getPosition(comfyPage, LEGACY_EDIT_TITLE),
        legacyEdited,
        'legacy edit after switching to Nodes 2.0'
      )

      const vueBefore = await getPosition(comfyPage, VUE_EDIT_TITLE)
      const vueNode = await comfyPage.vueNodes.getFixtureByTitle(VUE_EDIT_TITLE)
      await comfyMouse.dragElementBy(vueNode.header, { x: -60, y: 80 })
      const vueEdited = await getPosition(comfyPage, VUE_EDIT_TITLE)
      expect(vueEdited, 'Nodes 2.0 drag should move the node').not.toEqual(
        vueBefore
      )

      await comfyPage.menu.topbar.setVueNodesEnabled(false)
      expectSamePositionAcrossToggle(
        await getPosition(comfyPage, LEGACY_EDIT_TITLE),
        legacyEdited,
        'legacy edit after switching back'
      )
      expectSamePositionAcrossToggle(
        await getPosition(comfyPage, VUE_EDIT_TITLE),
        vueEdited,
        'Nodes 2.0 edit after switching back'
      )

      // Every node, not just the two edited: a round trip that dropped an
      // untouched node would leave both edits correct and be invisible to a
      // two-node comparison.
      const beforeRoundTrip = await getPositions(comfyPage)
      const serialized = await comfyPage.workflow.getExportedWorkflow()
      await comfyPage.workflow.loadGraphData(serialized)

      await expect.poll(() => getPositions(comfyPage)).toEqual(beforeRoundTrip)
    })
  }
)
