import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'

/** Locate a workflow label in whatever panel is visible (browse or search). */
function findWorkflow(page: Page, name: string) {
  return page
    .getByTestId(TestIds.sidebar.workflows)
    .locator('.node-label', { hasText: name })
}

test.describe('Workflow sidebar - search', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.workflow.setupWorkflowsDirectory({
      'alpha-workflow.json': 'default.json',
      'beta-workflow.json': 'default.json'
    })
  })

  test('Search filters saved workflows by name', async ({ comfyPage }) => {
    const tab = comfyPage.menu.workflowsTab
    await tab.open()

    const searchInput = comfyPage.page.getByPlaceholder('Search Workflow...')
    await searchInput.fill('alpha')

    await expect(findWorkflow(comfyPage.page, 'alpha-workflow')).toBeVisible()
    await expect(
      findWorkflow(comfyPage.page, 'beta-workflow')
    ).toBeHidden()
  })

  test('Clearing search restores all workflows', async ({ comfyPage }) => {
    const tab = comfyPage.menu.workflowsTab
    await tab.open()

    const searchInput = comfyPage.page.getByPlaceholder('Search Workflow...')
    await searchInput.fill('alpha')
    await expect(
      findWorkflow(comfyPage.page, 'beta-workflow')
    ).toBeHidden()

    await searchInput.fill('')

    await expect(tab.getPersistedItem('alpha-workflow')).toBeVisible()
    await expect(tab.getPersistedItem('beta-workflow')).toBeVisible()
  })

  test('Search with no matches shows empty results', async ({ comfyPage }) => {
    const tab = comfyPage.menu.workflowsTab
    await tab.open()

    const searchInput = comfyPage.page.getByPlaceholder('Search Workflow...')
    await searchInput.fill('nonexistent_xyz')

    await expect(
      findWorkflow(comfyPage.page, 'alpha-workflow')
    ).toBeHidden()
    await expect(
      findWorkflow(comfyPage.page, 'beta-workflow')
    ).toBeHidden()
  })
})
