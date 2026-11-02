import type { Locator } from '@playwright/test'
import { mergeTests } from '@playwright/test'

import {
  comfyPageFixture,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'
import { ExecutionHelper } from '@e2e/fixtures/helpers/ExecutionHelper'
import { TestIds } from '@e2e/fixtures/selectors'
import { assetPath } from '@e2e/fixtures/utils/paths'
import { webSocketFixture } from '@e2e/fixtures/ws'

const test = mergeTests(comfyPageFixture, webSocketFixture)

const SAVE_IMAGE_NODE = '9'
const KSAMPLER_NODE = '3'

function imageOutput(filename: string) {
  return { images: [{ filename, subfolder: '', type: 'output' }] }
}

async function renderedWidth(locator: Locator) {
  const box = await locator.boundingBox()
  if (!box) throw new Error('Output preview has no layout box')
  return box.width
}

test.describe('App mode mobile output zoom', { tag: ['@mobile'] }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.page.route('**/api/view?*', (route) =>
      route.fulfill({ path: assetPath('test_upload_image.png') })
    )
    await comfyPage.appMode.enterAppModeWithInputs([[KSAMPLER_NODE, 'seed']])
    await expect(comfyPage.appMode.mobile.view).toBeVisible()
  })

  test('pinches the output image in and out without breaking navigation', async ({
    comfyPage,
    getWebSocket
  }) => {
    const { mobile, outputHistory } = comfyPage.appMode
    const preview = mobile.view.getByTestId(TestIds.linear.imagePreview)
    const exec = new ExecutionHelper(comfyPage, await getWebSocket())
    const jobId = await exec.run()
    await comfyPage.nextFrame()
    exec.executionStart(jobId)
    exec.executed(jobId, SAVE_IMAGE_NODE, imageOutput('first.png'))
    exec.executed(jobId, SAVE_IMAGE_NODE, imageOutput('second.png'))
    await expect(outputHistory.imageOutputs).toHaveCount(2)
    await expect(preview).toHaveAttribute('src', /second\.png/)

    const fittedWidth = await renderedWidth(preview)

    await test.step('Spreading two fingers zooms the image in', async () => {
      await mobile.pinch(preview, { from: 40, to: 120 })
      await expect
        .poll(() => renderedWidth(preview))
        .toBeGreaterThan(fittedWidth * 2)
    })

    await test.step('Pinching two fingers zooms the image back out', async () => {
      const zoomedWidth = await renderedWidth(preview)
      await mobile.pinch(preview, { from: 120, to: 40 })
      await expect
        .poll(() => renderedWidth(preview))
        .toBeLessThan(zoomedWidth / 2)
    })

    await test.step('Repeated pinches keep responding', async () => {
      const startWidth = await renderedWidth(preview)
      await mobile.pinch(preview, { from: 40, to: 80 })
      await mobile.pinch(preview, { from: 40, to: 80 })
      await expect
        .poll(() => renderedWidth(preview))
        .toBeGreaterThan(startWidth * 3)
    })

    await test.step('Selecting another output swaps the preview', async () => {
      await outputHistory.selectInProgressItem(1)
      await expect(preview).toHaveAttribute('src', /first\.png/)
    })

    await test.step('Tab navigation still works after zooming', async () => {
      await mobile.navigateTab('assets')
      await expect(mobile.contentPanel).toHaveAccessibleName('Assets')
      await mobile.navigateTab('outputs')
      await expect(mobile.contentPanel).toHaveAccessibleName('Outputs')
      await expect(preview).toBeVisible()
    })
  })
})
