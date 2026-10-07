import { expect } from '@playwright/test'

import { bootAgentApp } from '@e2e/fixtures/agentPanelFixture'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { inlineReferencesTest as test } from '@e2e/fixtures/agentInlineReferencesFixture'
import { assetPath } from '@e2e/fixtures/utils/paths'

test.use({ hasTouch: true, viewport: { width: 1024, height: 768 } })

test(
  'discloses filenames and removes a staged asset without hover',
  { tag: '@cloud' },
  async ({ page, assetUpload }) => {
    await bootAgentApp(page, true)
    const panel = new AgentPanel(page)
    await panel.open()
    await panel.fileInput.setInputFiles(assetPath('test_upload_image.png'))
    await panel.fileInput.setInputFiles({
      name: 'notes.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Notes')
    })
    assetUpload.finish()
    await expect(panel.attachmentChips).toHaveCount(2)
    await panel.composer.fill('Keep this draft @test_upload')
    await panel.root
      .getByRole('menuitem', { name: 'test_upload_image.png', exact: true })
      .tap()
    await expect(
      panel.composer.getByTestId('asset-reference-chip')
    ).toHaveCount(1)
    await panel
      .attachmentChip('notes.txt')
      .getByRole('button', { name: 'Preview notes.txt', exact: true })
      .tap()
    const preview = page.getByRole('dialog', { name: 'notes.txt', exact: true })
    await expect(preview.getByText('notes.txt', { exact: true })).toBeVisible()
    await panel.composer.tap()
    await expect(preview).toHaveCount(0)
    const remove = panel
      .attachmentChip('test_upload_image.png')
      .getByRole('button', {
        name: 'Remove test_upload_image.png',
        exact: true
      })
    await expect
      .poll(() =>
        remove.evaluate((element) =>
          element.checkVisibility({ checkOpacity: true })
        )
      )
      .toBe(true)
    await remove.tap()
    await expect(panel.attachmentChip('test_upload_image.png')).toHaveCount(0)
    await expect(panel.attachmentChip('notes.txt')).toBeVisible()
    await expect(
      panel.composer.getByTestId('asset-reference-chip')
    ).toHaveCount(0)
    await expect(panel.composer).toContainText('Keep this draft')
  }
)
