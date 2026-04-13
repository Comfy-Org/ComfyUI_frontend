import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

test.beforeEach(async ({ comfyPage }) => {
  await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
  await comfyPage.closeMenu()
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
      'workflow.svg'
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
