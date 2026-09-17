import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

test('Dismissing a pending tab preview prevents it from appearing later', async ({
  comfyPage
}) => {
  const { page } = comfyPage
  const { topbar } = comfyPage.menu
  const popover = topbar.workflowTabPopover

  await page.clock.install({ time: 0 })
  await page.clock.pauseAt(60_000)
  await topbar.getTab(0).hover()
  await expect(popover.pendingShows).toHaveCount(1)

  await popover.dismiss()
  await page.clock.runFor(1000)

  await expect(popover.pendingShows).toHaveCount(0)
  await expect(popover.root).toHaveCount(0)
})
