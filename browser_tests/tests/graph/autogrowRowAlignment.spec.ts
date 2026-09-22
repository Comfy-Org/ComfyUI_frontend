import { expect } from '@playwright/test'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture as baseTest } from '@e2e/fixtures/ComfyPage'
import {
  AUTOGROW_REFERENCE_NODE_ID,
  AUTOGROW_REFERENCE_WORKFLOW,
  BYTEDANCE_REFERENCE_NODE_TYPE,
  REFERENCE_IMAGES_PREFIX,
  byteDanceReferenceNodeDef
} from '@e2e/fixtures/data/byteDanceReferenceNodeDef'
import type { NodeReference } from '@e2e/fixtures/utils/litegraphUtils'
import {
  getConnectedInputs,
  getInputNames,
  readAutogrowInputGroup
} from '@e2e/fixtures/utils/nodeInputLinks'
import { routeObjectInfoFromSetupApi } from '@e2e/fixtures/utils/objectInfo'
import { toNodeId } from '@/types/nodeId'

/**
 * Connects `source` to the autogrow group's current trailing (unlinked) slot
 * and waits for the group to grow by one before returning.
 *
 * Reads the trailing slot from the graph rather than a literal name - the
 * fixture's pre-existing links have already grown once (see
 * `readAutogrowInputGroup`'s docstring) - and polls after connecting instead
 * of reading once immediately after the drag: the connect happens inside a
 * scripted mouseup that only awaits a single animation frame, so grabbing the
 * next trailing slot before autogrow has materialized it would connect the
 * wrong index.
 */
async function connectNextReferenceImage(
  comfyPage: ComfyPage,
  referenceNode: NodeReference,
  source: NodeReference
): Promise<string> {
  const before = await readAutogrowInputGroup(
    comfyPage,
    AUTOGROW_REFERENCE_NODE_ID,
    REFERENCE_IMAGES_PREFIX
  )
  const trailingName = before.slotNames[before.trailingSlotIndex]
  const allInputs = await getInputNames(
    comfyPage,
    AUTOGROW_REFERENCE_NODE_ID,
    ''
  )
  const targetIndex = allInputs.indexOf(trailingName)
  expect(targetIndex).toBeGreaterThanOrEqual(0)

  await source.connectOutput(0, referenceNode, targetIndex)

  await expect
    .poll(() =>
      getInputNames(
        comfyPage,
        AUTOGROW_REFERENCE_NODE_ID,
        REFERENCE_IMAGES_PREFIX
      )
    )
    .toHaveLength(before.slotNames.length + 1)

  return trailingName
}

const test = baseTest.extend({
  page: async ({ page }, use) => {
    const unrouteObjectInfo = await routeObjectInfoFromSetupApi(
      page,
      (objectInfo) => {
        objectInfo[BYTEDANCE_REFERENCE_NODE_TYPE] = byteDanceReferenceNodeDef
      }
    )
    try {
      await use(page)
    } finally {
      await unrouteObjectInfo()
    }
  }
})

test.describe(
  'Autogrow reference-image row alignment',
  { tag: ['@vue-nodes', '@node'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow(AUTOGROW_REFERENCE_WORKFLOW)
      await comfyPage.vueNodes.waitForNodes()
    })

    test('keeps every connection dot aligned with its label after mouse-connecting 5 references', async ({
      comfyPage
    }, testInfo) => {
      test.setTimeout(30_000)

      const referenceNode = await comfyPage.nodeOps.getNodeRefById(
        AUTOGROW_REFERENCE_NODE_ID
      )

      const before = await readAutogrowInputGroup(
        comfyPage,
        AUTOGROW_REFERENCE_NODE_ID,
        REFERENCE_IMAGES_PREFIX
      )
      // The invariant this test builds on: autogrow keeps exactly one empty
      // trailing slot after however many are already connected. Read it
      // instead of restating the fixture's contents - this workflow is
      // shared with the subgraph-unpack tests and has already gained a link
      // once (see readAutogrowInputGroup's docstring).
      expect(before.connections.length).toBeGreaterThan(0)
      expect(before.slotNames).toHaveLength(before.connections.length + 1)

      const image4Source = await comfyPage.nodeOps.addNode(
        'LoadImage',
        undefined,
        { x: 100, y: 700 }
      )
      // Space the second source node below the first by more than its own
      // rendered height, so its header/output dot can never sit inside the
      // first source's rectangle.
      const image4Size = await image4Source.getSize()
      const image5Source = await comfyPage.nodeOps.addNode(
        'LoadImage',
        undefined,
        { x: 100, y: 700 + image4Size.height + 100 }
      )

      // Keep scripted drag targets clear of viewport-edge auto-pan.
      await comfyPage.page.evaluate(() => {
        window.app!.canvas.ds.scale = 0.4
        window.app!.canvas.ds.offset[0] = 0
        window.app!.canvas.ds.offset[1] = 0
        window.app!.canvas.setDirty(true, true)
      })
      await comfyPage.nextFrame()

      const image4Name = await connectNextReferenceImage(
        comfyPage,
        referenceNode,
        image4Source
      )
      const image5Name = await connectNextReferenceImage(
        comfyPage,
        referenceNode,
        image5Source
      )

      await expect
        .poll(() =>
          getConnectedInputs(
            comfyPage,
            AUTOGROW_REFERENCE_NODE_ID,
            REFERENCE_IMAGES_PREFIX
          )
        )
        .toEqual([
          ...before.connections,
          { name: image4Name, originNodeId: String(image4Source.id) },
          { name: image5Name, originNodeId: String(image5Source.id) }
        ])
      const names = await getInputNames(
        comfyPage,
        AUTOGROW_REFERENCE_NODE_ID,
        REFERENCE_IMAGES_PREFIX
      )
      // Grew by exactly two connected slots, plus the trailing empty slot
      // autogrow always maintains stays in place at the end.
      expect(names).toHaveLength(before.slotNames.length + 2)
      expect(names.slice(0, before.slotNames.length)).toEqual(before.slotNames)
      expect(names[before.slotNames.length]).toBe(image5Name)

      await expect(async () => {
        const allInputs = await getInputNames(
          comfyPage,
          AUTOGROW_REFERENCE_NODE_ID,
          ''
        )
        const alignment = await Promise.all(
          names.map(async (name) => {
            const index = allInputs.indexOf(name)
            expect(
              index,
              `slot ${name} missing from input list`
            ).toBeGreaterThanOrEqual(0)
            const row = comfyPage.vueNodes.getInputSlotRow(
              AUTOGROW_REFERENCE_NODE_ID,
              index
            )
            // Short, non-default timeouts here so a not-yet-rendered row
            // fails this attempt quickly instead of spending the outer
            // toPass's entire budget on a single try.
            await expect(row).toBeVisible({ timeout: 500 })
            await expect(row).toHaveText(
              name.slice(REFERENCE_IMAGES_PREFIX.length),
              { timeout: 500 }
            )
            const box = await row.boundingBox()
            if (!box) throw new Error(`row for ${name} has no bounding box`)
            const dotY = await comfyPage.page.evaluate(
              ({ nodeId, index }) => {
                const node = window.app!.canvas.graph!.getNodeById(nodeId)
                if (!node) throw new Error('node not found')
                const [x, y] = node.getInputPos(index)
                return window.app!.canvasPosToClientPos([x, y])[1]
              },
              { nodeId: toNodeId(AUTOGROW_REFERENCE_NODE_ID), index }
            )
            // Compare against the row's own center with a tolerance scaled
            // to its height, rather than "anywhere in the row" - the latter
            // would still pass for a dot visibly drifted within a single
            // row, which is the PM-946 symptom this test guards against.
            const rowCenterY = box.y + box.height / 2
            return {
              name,
              aligned: Math.abs(dotY - rowCenterY) <= box.height / 4
            }
          })
        )
        expect(alignment).toEqual(
          names.map((name) => ({ name, aligned: true }))
        )
      }).toPass({ timeout: 5000 })

      await testInfo.attach('workflow-after-five-connects', {
        body: await comfyPage.page.screenshot({
          path: testInfo.outputPath('workflow-after-five-connects.png')
        }),
        contentType: 'image/png'
      })
      await comfyPage.page.evaluate(() => {
        window.app!.canvas.ds.scale = 0.8
        window.app!.canvas.setDirty(true, true)
      })
      await referenceNode.centerOnNode()
      // centerOnNode() already awaits one animation frame internally for the
      // canvas redraw; wait for a second so the Vue-rendered node overlay has
      // a chance to settle into the new transform before the screenshot.
      await comfyPage.nextFrame()
      await testInfo.attach('reference-node-after-five-connects', {
        body: await comfyPage.vueNodes
          .getNodeLocator(AUTOGROW_REFERENCE_NODE_ID)
          .screenshot({
            path: testInfo.outputPath('reference-node-after-five-connects.png')
          }),
        contentType: 'image/png'
      })
    })
  }
)
