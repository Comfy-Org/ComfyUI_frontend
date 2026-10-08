import { expect } from '@playwright/test'

import { bootAgentApp } from '@e2e/fixtures/agentPanelFixture'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { inlineReferencesTest as test } from '@e2e/fixtures/agentInlineReferencesFixture'
import { DragDropHelper } from '@e2e/fixtures/helpers/DragDropHelper'
import { assetPath } from '@e2e/fixtures/utils/paths'

test(
  'keeps repeated file drops in one tray item while pending and after uploading',
  { tag: '@cloud' },
  async ({ page, assetUpload }) => {
    await bootAgentApp(page, true)
    const panel = new AgentPanel(page)
    await panel.open()
    await panel.composer.fill('Keep this draft')
    const drops = new DragDropHelper(page)
    const file = assetPath('test_upload_image.png')
    await drops.dropFileOn(panel.root, file)
    await expect(panel.attachmentChips).toHaveCount(1)
    await expect(
      panel.root.getByRole('status', { name: 'Uploading' })
    ).toBeVisible()
    await drops.dropFileOn(panel.root, file)
    await expect(panel.attachmentChips).toHaveCount(1)
    assetUpload.finish()
    await expect(
      panel.root.getByRole('status', { name: 'Uploading' })
    ).toHaveCount(0)
    await drops.dropFileOn(panel.root, file)
    await expect(panel.attachmentChips).toHaveCount(1)
    await panel.composer.press('End')
    await panel.composer.pressSequentially(' @test_upload')
    await panel.root
      .getByRole('menuitem', { name: 'test_upload_image.png', exact: true })
      .click()
    await panel.composer.pressSequentially(' @test_upload')
    await panel.root
      .getByRole('menuitem', { name: 'test_upload_image.png', exact: true })
      .click()
    await expect(
      panel.composer.getByTestId('asset-reference-chip')
    ).toHaveCount(2)
    await panel.attachmentChip('test_upload_image.png').hover()
    await panel
      .attachmentChip('test_upload_image.png')
      .getByRole('button', {
        name: 'Remove test_upload_image.png',
        exact: true
      })
      .click()
    await expect(panel.attachmentChips).toHaveCount(0)
    await expect(
      panel.composer.getByTestId('asset-reference-chip')
    ).toHaveCount(0)
    await drops.dropFileOn(panel.root, file)
    await expect(panel.attachmentChips).toHaveCount(1)
    await expect(panel.composer).toContainText('Keep this draft')
  }
)
