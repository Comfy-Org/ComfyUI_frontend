import { mergeTests } from '@playwright/test'

import {
  comfyExpect as expect,
  comfyPageFixture
} from '@e2e/fixtures/ComfyPage'
import { ExecutionHelper } from '@e2e/fixtures/helpers/ExecutionHelper'
import { webSocketFixture } from '@e2e/fixtures/ws'

const test = mergeTests(comfyPageFixture, webSocketFixture)

const still = { filename: 'example.png', subfolder: '', type: 'input' }
const clip = { filename: 'clip.mp4', subfolder: '', type: 'output' }

test.describe('Node preview parts', { tag: ['@vue-nodes', '@node'] }, () => {
  test('A run that saves images and a video shows the images and the video side by side', async ({
    comfyPage,
    getWebSocket
  }) => {
    await comfyPage.nodeOps.clearGraph()
    await comfyPage.searchBoxV2.addNode('Preview Image')
    const node = await comfyPage.vueNodes.getFixtureByTitle('Preview Image')
    const execution = new ExecutionHelper(comfyPage, await getWebSocket())

    execution.executed(await execution.run(), '1', { images: [still, clip] })

    await expect(
      node.root.getByRole('region', { name: /Image preview/ })
    ).toBeVisible()
    await expect(
      node.root.getByRole('region', { name: /Video preview/ })
    ).toBeVisible()
  })

  test('A node shows an image gallery or a video player, matching what its latest run produced', async ({
    comfyPage,
    getWebSocket
  }) => {
    await comfyPage.nodeOps.clearGraph()
    await comfyPage.searchBoxV2.addNode('Preview Image')
    const node = await comfyPage.vueNodes.getFixtureByTitle('Preview Image')
    const gallery = node.root.getByRole('region', { name: /Image preview/ })
    const player = node.root.getByRole('region', { name: /Video preview/ })
    const execution = new ExecutionHelper(comfyPage, await getWebSocket())
    async function finishRun(output: Record<string, unknown>) {
      const run = await execution.run()
      execution.executed(run, '1', output)
      execution.executionSuccess(run)
    }

    await test.step('a run configured for stills shows the gallery', async () => {
      await finishRun({ images: [still] })
      await expect(gallery).toBeVisible()
      await expect(player).toBeHidden()
    })

    await test.step('a run configured for video shows the player', async () => {
      await finishRun({ images: [clip], animated: [true] })
      await expect(player).toBeVisible()
      await expect(gallery).toBeHidden()
    })

    await test.step('switching back to stills shows the gallery again', async () => {
      await finishRun({ images: [still] })
      await expect(gallery).toBeVisible()
      await expect(player).toBeHidden()
    })
  })

  test('A node that sends progress text and live frames in one run shows both', async ({
    comfyPage,
    getWebSocket
  }) => {
    await comfyPage.nodeOps.clearGraph()
    await comfyPage.searchBoxV2.addNode('KSampler')
    const node = await comfyPage.vueNodes.getFixtureByTitle('KSampler')
    const execution = new ExecutionHelper(comfyPage, await getWebSocket())

    const run = await execution.run()
    execution.nodeRunning(run, '1', 3, 20)
    execution.progressText('1', 'Denoising step 3 of 20')
    execution.latentPreview(run, '1')

    await expect(node.root.getByText('Denoising step 3 of 20')).toBeVisible()
    await expect(
      node.root.getByRole('img', { name: 'Live sampling preview' })
    ).toBeVisible()
  })
})
