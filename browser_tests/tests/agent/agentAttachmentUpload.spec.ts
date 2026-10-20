import { expect } from '@playwright/test'
import type { Route } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { Tooltip } from '@e2e/fixtures/components/Tooltip'
import { assetPath } from '@e2e/fixtures/utils/paths'
import { agentTest as test } from '@e2e/tests/agent/agentPanelMocks'

test.describe('Agent attachment cancellation', { tag: '@cloud' }, () => {
  test('closing the panel removes a pending upload and preserves a sendable draft', async ({
    comfyPage,
    agentPanel
  }) => {
    const page = comfyPage.page
    let releaseUpload = () => {}
    const uploadHeld = new Promise<void>((resolve) => {
      releaseUpload = resolve
    })
    let uploadSettled = Promise.resolve()
    const holdUpload = (route: Route) => {
      uploadSettled = uploadHeld.then(() => route.abort())
      return uploadSettled
    }
    await page.route('**/api/upload/image', holdUpload)

    try {
      const openButton = page.getByRole('button', {
        name: enMessages.agent.entryButton,
        exact: true
      })
      await agentPanel.open()
      await agentPanel.selectWorkflow()
      const panel = page.locator('#agent-panel-root')
      const composer = agentPanel.composer
      const send = panel.getByRole('button', { name: 'Send', exact: true })
      await composer.fill('Keep this draft')
      await expect(send).toBeEnabled()

      const uploadReceived = page.waitForRequest('**/api/upload/image')
      await panel
        .getByTestId('agent-file-input')
        .setInputFiles(assetPath('plain_video.mp4'))
      await uploadReceived
      await expect(
        panel
          .getByTestId('composer-asset-section')
          .getByRole('group', { name: 'plain_video.mp4' })
      ).toBeVisible()
      await expect(send).toBeDisabled()

      await panel
        .getByRole('button', { name: enMessages.g.close, exact: true })
        .click()
      await expect(panel).toHaveCount(0)
      await openButton.click()

      await expect(composer).toHaveText('Keep this draft')
      await expect(
        panel.getByRole('group', { name: 'plain_video.mp4' })
      ).toHaveCount(0)
      await expect(send).toBeEnabled()
    } finally {
      releaseUpload()
      await uploadSettled
      await page.unroute('**/api/upload/image', holdUpload)
    }
  })
})

test.describe('Agent attachment validation', { tag: ['@cloud', '@ui'] }, () => {
  test('retains an invalid video across reopening and blocks Send until removal', async ({
    comfyPage,
    agentPanel
  }) => {
    await agentPanel.open()
    await agentPanel.selectWorkflow()
    await agentPanel.composer.fill('Describe this video')
    await expect(agentPanel.sendButton).toBeEnabled()
    await agentPanel.fileInput.setInputFiles({
      name: 'renamed.mp4',
      mimeType: 'video/mp4',
      buffer: Buffer.from('plain text')
    })

    await expect(
      agentPanel.attachmentChip('renamed.mp4').getByRole('status', {
        name: enMessages.agent.attachmentInvalidVideo.replace(
          '{name}',
          'renamed.mp4'
        )
      })
    ).toBeVisible()
    await expect(agentPanel.sendButton).toBeDisabled()
    await agentPanel.sendButton.hover()
    await expect(
      new Tooltip(comfyPage.page).named(
        enMessages.agent.sendBlockedByInvalidVideo.replace(
          '{name}',
          'renamed.mp4'
        )
      )
    ).toBeVisible()
    await agentPanel.composer.press('Enter')
    await expect(agentPanel.composer).toHaveText('Describe this video')
    await agentPanel.close()
    await agentPanel.open()
    await agentPanel.attachmentChip('renamed.mp4').getByRole('status').hover()
    await expect(
      new Tooltip(comfyPage.page).named(
        enMessages.agent.attachmentInvalidVideo.replace('{name}', 'renamed.mp4')
      )
    ).toBeVisible()
    await expect(agentPanel.sendButton).toBeDisabled()
    await expect(
      comfyPage.toast.withText(
        enMessages.agent.attachmentInvalidVideo.replace('{name}', 'renamed.mp4')
      )
    ).toHaveCount(0)
    await agentPanel.composer.press('End')
    await agentPanel.composer.pressSequentially(' @')
    await expect(
      agentPanel.root.getByRole('menuitem', {
        name: enMessages.agent.nodes,
        exact: true
      })
    ).toBeVisible()
    await expect(
      agentPanel.root.getByRole('menuitem', { name: 'renamed.mp4' })
    ).toHaveCount(0)
    await agentPanel.composer.press('Escape')
    const removeButton = agentPanel
      .attachmentChip('renamed.mp4')
      .getByRole('button', {
        name: enMessages.agent.removeAsset.replace('{name}', 'renamed.mp4')
      })
    await comfyPage.page.mouse.move(0, 0)
    await expect(removeButton).toHaveCSS('opacity', '0')
    await agentPanel.attachmentChip('renamed.mp4').hover()
    await expect(removeButton).toHaveCSS('opacity', '1')
    await removeButton.click()
    await expect(agentPanel.attachmentChip('renamed.mp4')).toHaveCount(0)
    await expect(agentPanel.sendButton).toBeEnabled()
  })

  test('shows an inline error for text renamed as video from drag and drop', async ({
    comfyPage,
    agentPanel
  }) => {
    const page = comfyPage.page
    await agentPanel.open()
    const dataTransfer = await page.evaluateHandle(() => {
      const transfer = new DataTransfer()
      transfer.items.add(
        new File(['plain text'], 'renamed.mp4', { type: 'video/mp4' })
      )
      return transfer
    })
    try {
      await agentPanel.root.dispatchEvent('drop', { dataTransfer })
    } finally {
      await dataTransfer.dispose()
    }

    await expect(
      agentPanel.attachmentChip('renamed.mp4').getByRole('status', {
        name: enMessages.agent.attachmentInvalidVideo.replace(
          '{name}',
          'renamed.mp4'
        )
      })
    ).toBeVisible()
    await agentPanel.attachmentChip('renamed.mp4').getByRole('status').hover()
    await expect(
      new Tooltip(comfyPage.page).named(
        enMessages.agent.attachmentInvalidVideo.replace('{name}', 'renamed.mp4')
      )
    ).toBeVisible()
  })
})
