import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../../fixtures/ComfyPage'

/** Locate a workflow label in whatever panel is visible (browse or search). */
function findWorkflow(page: Page, name: string) {
  return page
    .getByTestId('workflows-sidebar')
    .locator('.node-label', { hasText: name })
}

test.describe('Workflow sidebar - search', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.workflow.setupWorkflowsDirectory({
      'alpha-workflow.json': 'default.json',
      'beta-workflow.json': 'default.json'
    })
  })

  test('Search input is visible in workflows tab', async ({ comfyPage }) => {
    const tab = comfyPage.menu.workflowsTab
    await tab.open()

    await expect(
      comfyPage.page.getByPlaceholder('Search Workflow...')
    ).toBeVisible()
  })

  test('Search filters saved workflows by name', async ({ comfyPage }) => {
    const tab = comfyPage.menu.workflowsTab
    await tab.open()

    const searchInput = comfyPage.page.getByPlaceholder('Search Workflow...')
    await searchInput.fill('alpha')

    await expect(findWorkflow(comfyPage.page, 'alpha-workflow')).toBeVisible({
      timeout: 5000
    })
    await expect(
      findWorkflow(comfyPage.page, 'beta-workflow')
    ).not.toBeVisible()
  })

  test('Clearing search restores all workflows', async ({ comfyPage }) => {
    const tab = comfyPage.menu.workflowsTab
    await tab.open()

    const searchInput = comfyPage.page.getByPlaceholder('Search Workflow...')
    await searchInput.fill('alpha')
    await expect(
      findWorkflow(comfyPage.page, 'beta-workflow')
    ).not.toBeVisible()

    await searchInput.fill('')

    await expect(tab.getPersistedItem('alpha-workflow')).toBeVisible({
      timeout: 5000
    })
    await expect(tab.getPersistedItem('beta-workflow')).toBeVisible()
  })

  test('Search with no matches shows empty results', async ({ comfyPage }) => {
    const tab = comfyPage.menu.workflowsTab
    await tab.open()

    const searchInput = comfyPage.page.getByPlaceholder('Search Workflow...')
    await searchInput.fill('nonexistent_xyz')

    await expect(
      findWorkflow(comfyPage.page, 'alpha-workflow')
    ).not.toBeVisible()
    await expect(
      findWorkflow(comfyPage.page, 'beta-workflow')
    ).not.toBeVisible()
  })
})
