import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { waitForCloudApp } from '@e2e/fixtures/cloudAppFixture'
import { agentTest as test } from '@e2e/tests/agent/agentPanelMocks'

test.describe(
  'Agent composer draft survives a page refresh',
  { tag: ['@cloud', '@ui'] },
  () => {
    test('restores an unsent draft after a reload, but not one discarded by New Chat', async ({
      agentPanel,
      page
    }, testInfo) => {
      await agentPanel.open()
      const draft = 'Make the background a sunset over the ocean'

      await test.step('an unsent draft is still in the composer after a reload', async () => {
        await agentPanel.composer.fill(draft)
        await expect(agentPanel.composer).toHaveText(draft)

        await page.reload()
        await waitForCloudApp(page)
        await agentPanel.open()
        await expect(agentPanel.composer).toHaveText(draft)
        await testInfo.attach('draft-restored-after-reload', {
          body: await agentPanel.root.screenshot({
            path: testInfo.outputPath('draft-restored-after-reload.png')
          }),
          contentType: 'image/png'
        })
      })

      await test.step('New Chat leaves the composer empty after a reload', async () => {
        await agentPanel.root
          .getByRole('button', { name: enMessages.agent.newChat })
          .click()
        await expect(agentPanel.composer).toHaveText('')

        await page.reload()
        await waitForCloudApp(page)
        await agentPanel.open()
        await expect(
          agentPanel.root.getByText(enMessages.agent.placeholder, {
            exact: true
          })
        ).toBeVisible()
        await expect(agentPanel.composer).toHaveText('')
        await testInfo.attach('new-chat-empty-after-reload', {
          body: await agentPanel.root.screenshot({
            path: testInfo.outputPath('new-chat-empty-after-reload.png')
          }),
          contentType: 'image/png'
        })
      })
    })
  }
)
