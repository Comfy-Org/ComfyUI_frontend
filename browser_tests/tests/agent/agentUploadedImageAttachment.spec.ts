import type { UploadImageResponse } from '@comfyorg/ingest-types'
import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { promptHistoryTest as test } from '@e2e/fixtures/agentPromptHistoryFixture'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { assetPath } from '@e2e/fixtures/utils/paths'

test.use({ connectWebSocketToServer: false })

test(
  'keeps an uploaded image decodable in Gallery after sending',
  { tag: ['@cloud', '@agent', '@ui'] },
  async ({ page, workflowSelection, promptHistory }) => {
    const response: UploadImageResponse = {
      name: 'reference.png',
      subfolder: '',
      type: 'input'
    }
    await page.route('**/api/upload/image', (route) =>
      route.fulfill(jsonRoute(response))
    )
    await page.route('**/view?filename=reference.png&type=input', (route) =>
      route.fulfill({ path: assetPath('image32x32.webp') })
    )

    await page
      .getByRole('button', { name: enMessages.agent.entryButton })
      .click()
    await page
      .getByRole('button', {
        name: enMessages.sideToolbar.newBlankWorkflow,
        exact: true
      })
      .click()
    const panel = page.locator('#agent-panel-root')
    await expect(panel).toBeVisible()
    await panel
      .getByRole('button', { name: enMessages.agent.switchWorkflow })
      .click()
    await page
      .getByRole('menuitemradio', { name: 'Unsaved Workflow', exact: true })
      .click()
    await expect.poll(() => workflowSelection.savedPaths.length).toBe(1)
    workflowSelection.finishSave(true)

    await panel
      .getByTestId('agent-file-input')
      .setInputFiles(assetPath('image32x32.webp'))
    await expect(panel.getByTestId('asset-reference-chip')).toHaveCount(1)
    await panel
      .getByRole('textbox', { name: /^Describe ideas/ })
      .pressSequentially('use this upload')
    await panel
      .getByRole('button', { name: enMessages.agent.send, exact: true })
      .click()
    await expect.poll(() => promptHistory.requests.length).toBe(1)

    const image = panel.getByTestId('reply-image-preview')
    await expect(image).toBeVisible()
    await image.evaluate((element: HTMLImageElement) => element.decode())
    expect(
      await image.evaluate((element: HTMLImageElement) => element.naturalWidth)
    ).toBe(32)
    await image.click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    const enlarged = dialog.locator('img').first()
    await enlarged.evaluate((element: HTMLImageElement) => element.decode())
    expect(
      await enlarged.evaluate(
        (element: HTMLImageElement) => element.naturalWidth
      )
    ).toBe(32)
    await dialog.screenshot({
      path: 'test-results/uploaded-image-attachment-gallery.png'
    })
  }
)
