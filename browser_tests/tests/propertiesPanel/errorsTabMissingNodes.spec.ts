import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'
import { loadWorkflowAndOpenErrorsTab } from '@e2e/fixtures/helpers/ErrorsTabHelper'

test.describe('Errors tab - Missing nodes', { tag: ['@ui', '@canvas'] }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting(
      'Comfy.RightSidePanel.ShowErrorsTab',
      true
    )
  })

  test('Should show missing node pack card with guidance', async ({
    comfyPage
  }) => {
    await loadWorkflowAndOpenErrorsTab(comfyPage, 'missing/missing_nodes')

    const missingNodeGroup = comfyPage.page.getByTestId(
      TestIds.dialogs.missingNodePacksGroup
    )

    await expect(
      comfyPage.page.getByTestId(TestIds.dialogs.missingNodeCard)
    ).toBeVisible()
    await expect(missingNodeGroup).toBeVisible()
    await expect(
      missingNodeGroup.getByTestId(TestIds.dialogs.errorGroupDisplayMessage)
    ).toHaveText(/\S/)
  })

  test('Should show unknown pack node rows by default', async ({
    comfyPage
  }) => {
    await loadWorkflowAndOpenErrorsTab(comfyPage, 'missing/missing_nodes')

    const missingNodeCard = comfyPage.page.getByTestId(
      TestIds.dialogs.missingNodeCard
    )
    await expect(missingNodeCard.getByText('Unknown pack')).toBeVisible()
    await expect(
      missingNodeCard.getByRole('button', { name: 'UNKNOWN NODE', exact: true })
    ).toBeVisible()
  })

  test('Should show subgraph missing node rows by default', async ({
    comfyPage
  }) => {
    await loadWorkflowAndOpenErrorsTab(
      comfyPage,
      'missing/missing_nodes_in_subgraph'
    )

    const missingNodeCard = comfyPage.page.getByTestId(
      TestIds.dialogs.missingNodeCard
    )
    await expect(
      missingNodeCard.getByRole('button', {
        name: 'MISSING_NODE_TYPE_IN_SUBGRAPH',
        exact: true
      })
    ).toBeVisible()
  })

  test('Should locate missing node from the row label', async ({
    comfyPage
  }) => {
    await loadWorkflowAndOpenErrorsTab(comfyPage, 'missing/missing_nodes')

    const missingNodeCard = comfyPage.page.getByTestId(
      TestIds.dialogs.missingNodeCard
    )
    await comfyPage.canvasOps.pan({ x: -800, y: -800 })
    const offsetBeforeLocate = await comfyPage.canvasOps.getOffset()

    await missingNodeCard
      .getByRole('button', { name: 'UNKNOWN NODE', exact: true })
      .click()

    await expect
      .poll(() => comfyPage.canvasOps.getOffset())
      .not.toEqual(offsetBeforeLocate)
  })

  test('Should toggle grouped pack nodes from chevron and title', async ({
    comfyPage
  }) => {
    await loadWorkflowAndOpenErrorsTab(
      comfyPage,
      'missing/missing_nodes_same_pack'
    )

    const missingNodeCard = comfyPage.page.getByTestId(
      TestIds.dialogs.missingNodeCard
    )
    const packTitle = missingNodeCard.getByRole('button', {
      name: 'test-missing-node-pack'
    })
    const expandButton = missingNodeCard.getByTestId(
      TestIds.dialogs.missingNodePackExpand
    )
    const firstNode = missingNodeCard.getByRole('button', {
      name: 'TEST_MISSING_PACK_NODE_A',
      exact: true
    })
    const secondNode = missingNodeCard.getByRole('button', {
      name: 'TEST_MISSING_PACK_NODE_B',
      exact: true
    })

    await expect(packTitle).toBeVisible()
    await expect(
      missingNodeCard.getByTestId(TestIds.dialogs.missingNodePackCount)
    ).toHaveText('2')
    await expect(firstNode).toBeHidden()
    await expect(secondNode).toBeHidden()

    await expandButton.click()
    await expect(firstNode).toBeVisible()
    await expect(secondNode).toBeVisible()

    await packTitle.click()
    await expect(firstNode).toBeHidden()
    await expect(secondNode).toBeHidden()

    await packTitle.click()
    await expect(firstNode).toBeVisible()
    await expect(secondNode).toBeVisible()
  })
})
