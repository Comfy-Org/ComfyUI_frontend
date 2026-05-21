import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

test.beforeEach(async ({ comfyPage }) => {
  await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
})

test.describe(
  'Load Workflow in Media',
  { tag: ['@screenshot', '@workflow'] },
  () => {
    const fileNames = [
      'workflow.webp',
      'edited_workflow.webp',
      'no_workflow.webp',
      'large_workflow.webp',
      'workflow_prompt_parameters.png',
      'workflow_itxt.png',
      'workflow.webm',
      // Skipped due to 3d widget unstable visual result.
      // 3d widget shows grid after fully loaded.
      // 'workflow.glb',
      'workflow.mp4',
      'workflow.mov',
      'workflow.m4v',
      'workflow.svg',
      'workflow.ogg'
      // TODO: Re-enable after fixing test asset to use core nodes only
      // Currently opens missing nodes dialog which is outside scope of AVIF loading functionality
      // 'workflow.avif'
    ]
    const filesWithUpload = new Set(['no_workflow.webp'])

    fileNames.forEach(async (fileName) => {
      test(`Load workflow in ${fileName} (drop from filesystem)`, async ({
        comfyPage
      }) => {
        const shouldUpload = filesWithUpload.has(fileName)
        const uploadRequestPromise = shouldUpload
          ? comfyPage.page.waitForRequest((req) =>
              req.url().includes('/upload/')
            )
          : null

        await comfyPage.dragDrop.dragAndDropFile(`workflowInMedia/${fileName}`)

        if (uploadRequestPromise) {
          const request = await uploadRequestPromise
          expect(request.url()).toContain('/upload/')
        } else {
          await expect(comfyPage.canvas).toHaveScreenshot(`${fileName}.png`)
        }
      })
    })

    const urls = [
      'https://comfyanonymous.github.io/ComfyUI_examples/hidream/hidream_dev_example.png'
    ]
    urls.forEach(async (url) => {
      test(`Load workflow from URL ${url} (drop from different browser tabs)`, async ({
        comfyPage
      }) => {
        const initialNodeCount = await comfyPage.nodeOps.getGraphNodesCount()

        await comfyPage.dragDrop.dragAndDropURL(url)

        // The drop triggers an async fetch → parse → loadGraphData chain.
        // Poll until the graph settles with the loaded workflow's nodes.
        await expect
          .poll(() => comfyPage.nodeOps.getGraphNodesCount(), {
            timeout: 15000
          })
          .toBeGreaterThan(initialNodeCount)
      })
    })

    test.describe('Image without workflow', () => {
      test('places LoadImage at the drop cursor when graph_mouse is stale', async ({
        comfyPage
      }) => {
        await comfyPage.nodeOps.clearGraph()
        await expect.poll(() => comfyPage.nodeOps.getGraphNodesCount()).toBe(0)

        await comfyPage.page.evaluate(() => {
          window.app!.canvas.graph_mouse[0] = -9999
          window.app!.canvas.graph_mouse[1] = -9999
        })

        const dropPosition = { x: 480, y: 320 }
        await comfyPage.dragDrop.dragAndDropFile('image32x32.webp', {
          dropPosition,
          waitForUpload: true
        })

        await expect.poll(() => comfyPage.nodeOps.getGraphNodesCount()).toBe(1)

        const { nodePos, expectedPos } = await comfyPage.page.evaluate(
          (drop) => {
            const canvas = window.app!.canvas
            const expected = canvas.convertEventToCanvasOffset(
              new MouseEvent('drop', {
                clientX: drop.x,
                clientY: drop.y
              })
            ) as [number, number]
            const node = window.app!.graph.nodes[0]
            return {
              nodePos: [node.pos[0], node.pos[1]] as [number, number],
              expectedPos: expected
            }
          },
          dropPosition
        )

        expect(nodePos[0]).toBeCloseTo(expectedPos[0], 0)
        expect(nodePos[1]).toBeCloseTo(expectedPos[1], 0)
        expect(nodePos[0]).not.toBe(-9999)
        expect(nodePos[1]).not.toBe(-9999)
      })

      test('places LoadImage above existing nodes (zIndex)', async ({
        comfyPage
      }) => {
        await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
        await comfyPage.vueNodes.waitForNodes()

        const initialNodeIds = await comfyPage.vueNodes.getNodeIds()
        expect(initialNodeIds.length).toBeGreaterThan(0)

        await comfyPage.dragDrop.dragAndDropFile('image32x32.webp', {
          dropPosition: { x: 540, y: 380 },
          waitForUpload: true
        })

        await expect
          .poll(() => comfyPage.vueNodes.getNodeCount())
          .toBe(initialNodeIds.length + 1)

        const newNodeIds = await comfyPage.vueNodes.getNodeIds()
        const addedNodeId = newNodeIds.find(
          (id) => !initialNodeIds.includes(id)
        )
        expect(addedNodeId).toBeDefined()

        const newNodeZ = await comfyPage.vueNodes
          .getNodeLocator(addedNodeId!)
          .evaluate((el) => Number((el as HTMLElement).style.zIndex))

        const existingZIndexes = await comfyPage.vueNodes.nodes.evaluateAll(
          (els, id) =>
            els
              .filter((el) => el.getAttribute('data-node-id') !== id)
              .map((el) => Number((el as HTMLElement).style.zIndex)),
          addedNodeId!
        )

        expect(newNodeZ).toBeGreaterThan(Math.max(0, ...existingZIndexes))
      })
    })

    test('Load workflow from URL dropped onto Vue node', async ({
      comfyPage
    }) => {
      const fakeUrl = 'https://example.com/workflow.png'
      await comfyPage.page.route(fakeUrl, (route) =>
        route.fulfill({
          path: comfyPage.assetPath('workflowInMedia/workflow_itxt.png')
        })
      )

      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
      await comfyPage.vueNodes.waitForNodes()

      const initialNodeCount = await comfyPage.nodeOps.getGraphNodesCount()

      const node = comfyPage.vueNodes.getNodeByTitle('KSampler')
      await expect.poll(() => node.boundingBox()).toBeTruthy()
      const box = (await node.boundingBox())!

      const dropPosition = {
        x: box.x + box.width / 2,
        y: box.y + box.height / 2
      }

      await comfyPage.dragDrop.dragAndDropURL(fakeUrl, {
        dropPosition,
        preserveNativePropagation: true
      })

      await comfyPage.page.waitForFunction(
        (prevCount) => window.app!.graph.nodes.length !== prevCount,
        initialNodeCount,
        { timeout: 10000 }
      )

      await expect
        .poll(() => comfyPage.nodeOps.getGraphNodesCount())
        .not.toBe(initialNodeCount)
    })
  }
)
