import { expect } from '@playwright/test'

import { partnerNodeGovernanceTest as test } from '@e2e/fixtures/partnerNodeGovernanceFixture'
import { TestIds } from '@e2e/fixtures/selectors'

test.describe('Partner node governance workbench', { tag: '@cloud' }, () => {
  test('blocks queueing a disabled partner node', async ({
    page,
    partnerNodeGovernance
  }) => {
    await page.getByTestId(TestIds.topbar.queueButton).click()

    const policyAlert = page.getByRole('alert')
    await expect(policyAlert).toContainText('1 partner node is unavailable')
    await expect(policyAlert).toContainText(
      'Disabled Partner Node is disabled by your workspace policy.'
    )
    expect(partnerNodeGovernance.promptRequestCount()).toBe(0)
  })
})
