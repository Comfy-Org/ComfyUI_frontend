import { expect } from '@playwright/test'

import { partnerNodeGovernanceTest as test } from '@e2e/fixtures/partnerNodeGovernanceFixture'
import { TestIds } from '@e2e/fixtures/selectors'

test.describe('Partner node governance workbench', { tag: '@cloud' }, () => {
  test('hides nodes from disabled providers in search', async ({
    page,
    partnerNodeGovernance
  }) => {
    await page.evaluate(() =>
      window.app!.extensionManager.command.execute('Workspace.SearchBox.Toggle')
    )
    const search = page.getByRole('search')
    await search.getByRole('combobox').fill('Disabled Partner Node')

    await expect(
      search.getByTestId(TestIds.searchBoxV2.resultItem)
    ).toHaveCount(0)
    await expect(
      search.getByTestId(TestIds.searchBoxV2.noResults)
    ).toBeVisible()
    expect(partnerNodeGovernance.promptRequestCount()).toBe(0)
  })

  test('blocks queueing a disabled provider before the prompt request', async ({
    page,
    partnerNodeGovernance
  }) => {
    await page.getByTestId(TestIds.topbar.queueButton).click()

    const policyAlert = page.getByRole('alert')
    await expect(policyAlert).toContainText('Partner nodes')
    await expect(policyAlert).toContainText(
      'This node has been disabled by your team admin.'
    )
    expect(partnerNodeGovernance.promptRequestCount()).toBe(0)
  })
})
