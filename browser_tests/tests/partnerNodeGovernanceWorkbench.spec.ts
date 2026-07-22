import { expect } from '@playwright/test'

import { partnerNodeGovernanceTest as test } from '@e2e/fixtures/partnerNodeGovernanceFixture'
import { TestIds } from '@e2e/fixtures/selectors'

test.describe('Partner node governance workbench', { tag: '@cloud' }, () => {
  test('blocks queueing a disabled partner node', async ({
    page,
    partnerNodeGovernance
  }) => {
    await page.getByTestId(TestIds.topbar.queueButton).click()

    await expect(page.getByRole('alert')).toContainText(
      'Workflow blocked by workspace policy'
    )
    expect(partnerNodeGovernance.promptRequestCount()).toBe(0)
  })
})
