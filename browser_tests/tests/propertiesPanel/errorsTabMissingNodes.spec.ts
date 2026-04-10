import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'
import { loadWorkflowAndOpenErrorsTab } from '@e2e/tests/propertiesPanel/ErrorsTabHelper'

test.describe('Errors tab - Missing nodes', { tag: '@ui' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
    await comfyPage.settings.setSetting(
      'Comfy.RightSidePanel.ShowErrorsTab',
      true
    )
  })

  test('Should show MissingNodeCard in errors tab', async ({ comfyPage }) => {
    await loadWorkflowAndOpenErrorsTab(comfyPage, 'missing/missing_nodes')

    await expect(
      comfyPage.page.getByTestId(TestIds.errorsTab.missingNodeCard)
    ).toBeVisible()
  })

  test('Should show missing node packs group', async ({ comfyPage }) => {
    await loadWorkflowAndOpenErrorsTab(comfyPage, 'missing/missing_nodes')

    await expect(
      comfyPage.page.getByTestId(TestIds.errorsTab.missingNodePacksGroup)
    ).toBeVisible()
  })

  test('Should expand pack group to reveal node type names', async ({
    comfyPage
  }) => {
    await loadWorkflowAndOpenErrorsTab(
      comfyPage,
      'missing/missing_nodes_in_subgraph'
    )

    const missingNodeCard = comfyPage.page.getByTestId(
      TestIds.errorsTab.missingNodeCard
    )
    await expect(missingNodeCard).toBeVisible()

    await missingNodeCard
      .getByRole('button', { name: /expand/i })
      .first()
      .click()
    await expect(
      missingNodeCard.getByText('MISSING_NODE_TYPE_IN_SUBGRAPH')
    ).toBeVisible()
  })

  test('Should collapse expanded pack group', async ({ comfyPage }) => {
    await loadWorkflowAndOpenErrorsTab(
      comfyPage,
      'missing/missing_nodes_in_subgraph'
    )

    const missingNodeCard = comfyPage.page.getByTestId(
      TestIds.errorsTab.missingNodeCard
    )
    await missingNodeCard
      .getByRole('button', { name: /expand/i })
      .first()
      .click()
    await expect(
      missingNodeCard.getByText('MISSING_NODE_TYPE_IN_SUBGRAPH')
    ).toBeVisible()

    await missingNodeCard
      .getByRole('button', { name: /collapse/i })
      .first()
      .click()
    await expect(
      missingNodeCard.getByText('MISSING_NODE_TYPE_IN_SUBGRAPH')
    ).not.toBeVisible()
  })

  test('Locate node button is visible for expanded pack nodes', async ({
    comfyPage
  }) => {
    await loadWorkflowAndOpenErrorsTab(
      comfyPage,
      'missing/missing_nodes_in_subgraph'
    )

    const missingNodeCard = comfyPage.page.getByTestId(
      TestIds.errorsTab.missingNodeCard
    )
    await missingNodeCard
      .getByRole('button', { name: /expand/i })
      .first()
      .click()

    const locateButton = missingNodeCard.getByRole('button', {
      name: /locate/i
    })
    await expect(locateButton.first()).toBeVisible()
    // TODO: Add navigation assertion once subgraph node ID deduplication
    // timing is fixed. Currently, collectMissingNodes runs before
    // configure(), so execution IDs use pre-remapped node IDs that don't
    // match the runtime graph. See PR #9510 / #8762.
  })
})
