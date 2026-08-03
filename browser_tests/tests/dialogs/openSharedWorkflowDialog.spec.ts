import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import type { z } from 'zod'

import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'
import type { zSharedWorkflowResponse } from '@/platform/workflow/sharing/schemas/shareSchemas'

type SharedWorkflowResponse = z.input<typeof zSharedWorkflowResponse>

const shareId = 'fe828-long-name'

// Unbroken, space-free name (mimics a content-hash workflow name) that cannot
// wrap at whitespace and previously forced the dialog to scroll horizontally.
const longWorkflowName =
  'c23df0133afe9cf61a9c0e3b1f5d8a7e6429bd14f0a3c8e2d9b7165430fedcba99887766554433221100ffeeddccbbaa'

const longNameWorkflowResponse: SharedWorkflowResponse = {
  share_id: shareId,
  workflow_id: 'fe828-long-name-workflow',
  name: longWorkflowName,
  listed: true,
  publish_time: '2026-05-01T00:00:00Z',
  workflow_json: {
    version: 0.4,
    last_node_id: 0,
    last_link_id: 0,
    nodes: [],
    links: []
  },
  assets: []
}

async function mockLongNameSharedWorkflow(page: Page): Promise<void> {
  await page.route(`**/workflows/published/${shareId}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(longNameWorkflowResponse)
    })
  })
}

const test = comfyPageFixture

test.describe('Open shared workflow dialog', { tag: '@cloud' }, () => {
  test('wraps a long workflow name instead of scrolling horizontally', async ({
    comfyPage
  }) => {
    const { page } = comfyPage
    await mockLongNameSharedWorkflow(page)
    await comfyPage.setup({ clearStorage: false, url: `/?share=${shareId}` })

    const dialog = page.getByTestId(TestIds.dialogs.openSharedWorkflow)
    await expect(
      dialog.getByTestId(TestIds.dialogs.openSharedWorkflowTitle)
    ).toBeVisible()

    const heading = dialog.locator('main h2')
    await expect(heading).toHaveText(longWorkflowName)

    const { scrollWidth, clientWidth } = await dialog.evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth
    }))
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1)
  })
})
