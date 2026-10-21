import { expect } from '@playwright/test'
import { comfyPageFixture as baseTest } from '@e2e/fixtures/ComfyPage'
import {
  AUTOGROW_REFERENCE_NODE_ID,
  AUTOGROW_REFERENCE_WORKFLOW,
  BYTEDANCE_REFERENCE_NODE_TYPE,
  REFERENCE_IMAGES_PREFIX,
  byteDanceReferenceNodeDef
} from '@e2e/fixtures/data/byteDanceReferenceNodeDef'
import {
  getConnectedInputs,
  getInputNames
} from '@e2e/fixtures/utils/nodeInputLinks'
import { routeObjectInfoFromSetupApi } from '@e2e/fixtures/utils/objectInfo'
import { toNodeId } from '@/types/nodeId'

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
      const image4Source = await comfyPage.nodeOps.addNode(
        'LoadImage',
        undefined,
        { x: 100, y: 700 }
      )
      const image4Bounds = await image4Source.getBounding()
      const image5Source = await comfyPage.nodeOps.addNode(
        'LoadImage',
        undefined,
        { x: image4Bounds.x + image4Bounds.width + 80, y: 700 }
      )

      const connectionsBefore = await getConnectedInputs(
        comfyPage,
        AUTOGROW_REFERENCE_NODE_ID,
        REFERENCE_IMAGES_PREFIX
      )
      expect(connectionsBefore).toEqual([
        { name: `${REFERENCE_IMAGES_PREFIX}image_1`, originNodeId: '18' },
        { name: `${REFERENCE_IMAGES_PREFIX}image_2`, originNodeId: '19' },
        { name: `${REFERENCE_IMAGES_PREFIX}image_3`, originNodeId: '20' }
      ])

      // Keep scripted drag targets clear of viewport-edge auto-pan.
      await comfyPage.page.evaluate(() => {
        window.app!.canvas.ds.scale = 0.4
        window.app!.canvas.ds.offset[0] = 0
        window.app!.canvas.ds.offset[1] = 0
        window.app!.canvas.setDirty(true, true)
      })
      await comfyPage.nextFrame()
      const inputsBefore = await getInputNames(
        comfyPage,
        AUTOGROW_REFERENCE_NODE_ID,
        ''
      )
      const image4Index = inputsBefore.indexOf(
        `${REFERENCE_IMAGES_PREFIX}image_4`
      )
      expect(image4Index).toBeGreaterThanOrEqual(0)
      await image4Source.connectOutput(0, referenceNode, image4Index)
      const inputsAfterFourth = await getInputNames(
        comfyPage,
        AUTOGROW_REFERENCE_NODE_ID,
        ''
      )
      const image5Index = inputsAfterFourth.indexOf(
        `${REFERENCE_IMAGES_PREFIX}image_5`
      )
      expect(image5Index).toBeGreaterThanOrEqual(0)
      await image5Source.connectOutput(0, referenceNode, image5Index)
      await comfyPage.nextFrame()

      await expect
        .poll(() =>
          getConnectedInputs(
            comfyPage,
            AUTOGROW_REFERENCE_NODE_ID,
            REFERENCE_IMAGES_PREFIX
          )
        )
        .toEqual([
          ...connectionsBefore,
          {
            name: `${REFERENCE_IMAGES_PREFIX}image_4`,
            originNodeId: String(image4Source.id)
          },
          {
            name: `${REFERENCE_IMAGES_PREFIX}image_5`,
            originNodeId: String(image5Source.id)
          }
        ])
      const names = await getInputNames(
        comfyPage,
        AUTOGROW_REFERENCE_NODE_ID,
        REFERENCE_IMAGES_PREFIX
      )
      expect(names).toEqual(
        ['image_1', 'image_2', 'image_3', 'image_4', 'image_5', 'image_6'].map(
          (name) => `${REFERENCE_IMAGES_PREFIX}${name}`
        )
      )

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
          await expect(row).toBeVisible()
          expect((await row.textContent())?.trim()).toBe(
            name.slice(REFERENCE_IMAGES_PREFIX.length)
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
          return {
            name,
            aligned: Math.abs(dotY - (box.y + box.height / 2)) <= 2
          }
        })
      )
      expect(alignment).toEqual(names.map((name) => ({ name, aligned: true })))

      const source4Box = await comfyPage.vueNodes
        .getNodeLocator(String(image4Source.id))
        .boundingBox()
      const source5Box = await comfyPage.vueNodes
        .getNodeLocator(String(image5Source.id))
        .boundingBox()
      if (!source4Box || !source5Box)
        throw new Error('reference source has no bounding box')
      expect(source4Box.x + source4Box.width).toBeLessThan(source5Box.x)

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
