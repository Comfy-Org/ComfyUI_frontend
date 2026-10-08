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
    await drops.dropFilesOn(panel.root, [file])
    await expect(panel.attachmentChips).toHaveCount(1)
    await expect(
      panel.root.getByRole('status', { name: 'Uploading' })
    ).toBeVisible()
    await drops.dropFilesOn(panel.root, [file])
    await expect(panel.attachmentChips).toHaveCount(1)
    const notice = page
      .getByRole('alert')
      .filter({ hasText: 'test_upload_image.png is already in the asset tray' })
    await expect(notice).toHaveCount(1)
    await expect(panel.composer).toBeFocused()
    await expect(panel.composer).toContainText('Keep this draft')
    await notice.getByRole('button', { name: 'Close' }).click()
    assetUpload.finish()
    await expect(
      panel.root.getByRole('status', { name: 'Uploading' })
    ).toHaveCount(0)
    await drops.dropFilesOn(panel.root, [file])
    await expect(panel.attachmentChips).toHaveCount(1)
    await expect(notice).toHaveCount(1)
    await notice.getByRole('button', { name: 'Close' }).click()
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
    await drops.dropFilesOn(panel.root, [file])
    await expect(panel.attachmentChips).toHaveCount(1)
    await expect(panel.composer).toContainText('Keep this draft')
  }
)

test(
  'shows one plural duplicate notice while continuing a mixed pending batch',
  { tag: '@cloud' },
  async ({ page, assetUpload }) => {
    await bootAgentApp(page, true)
    const panel = new AgentPanel(page)
    await panel.open()
    await panel.composer.fill('Keep this draft')
    const drops = new DragDropHelper(page)
    const file = assetPath('test_upload_image.png')
    await drops.dropFilesOn(panel.root, [file])
    await expect(panel.attachmentChips).toHaveCount(1)
    await drops.dropFilesOn(panel.root, [file, file, assetPath('silence.wav')])
    await expect(panel.attachmentChips).toHaveCount(2)
    await expect(panel.attachmentChip('test_upload_image.png')).toBeVisible()
    await expect(panel.attachmentChip('silence.wav')).toBeVisible()
    await expect(
      page.getByRole('alert').filter({ hasText: 'Skipped 2 duplicate assets' })
    ).toHaveCount(1)
    await expect(
      panel.root.getByRole('status', { name: 'Uploading', exact: true })
    ).toHaveCount(2)
    await expect(panel.composer).toBeFocused()
    await expect(panel.composer).toContainText('Keep this draft')
    assetUpload.finish()
    await expect(
      panel.root.getByRole('status', { name: 'Uploading', exact: true })
    ).toHaveCount(0)
    await expect(panel.attachmentChips).toHaveCount(2)
  }
)
