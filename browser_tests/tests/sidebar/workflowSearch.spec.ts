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
    await expect(findWorkflow(comfyPage.page, 'beta-workflow')).toBeHidden()
  })

  test('Clearing search restores all workflows', async ({ comfyPage }) => {
    const tab = comfyPage.menu.workflowsTab
    await tab.open()

    const searchInput = comfyPage.page.getByPlaceholder('Search Workflow...')
    await searchInput.fill('alpha')
    await expect(findWorkflow(comfyPage.page, 'beta-workflow')).toBeHidden()

    await searchInput.fill('')

    await expect(tab.getPersistedItem('alpha-workflow')).toBeVisible()
    await expect(tab.getPersistedItem('beta-workflow')).toBeVisible()
  })

  test('Search with no matches shows empty results', async ({ comfyPage }) => {
    const tab = comfyPage.menu.workflowsTab
    await tab.open()

    const searchInput = comfyPage.page.getByPlaceholder('Search Workflow...')
    await searchInput.fill('nonexistent_xyz')

    await expect(findWorkflow(comfyPage.page, 'alpha-workflow')).toBeHidden()
    await expect(findWorkflow(comfyPage.page, 'beta-workflow')).toBeHidden()
  })
})

test.describe('Workflow sidebar - search + deletion', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.workflow.setupWorkflowsDirectory({
      'alpha-workflow.json': 'default.json',
      'beta-workflow.json': 'default.json',
      'gamma-workflow.json': 'default.json'
    })
    await comfyPage.settings.setSetting('Comfy.Workflow.ConfirmDelete', false)
  })

  test('Deleting a workflow while search is active removes it from results', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.workflowsTab
    await tab.open()

    const searchInput = comfyPage.page.getByPlaceholder('Search Workflow...')
    await searchInput.fill('alpha')
    await expect(findWorkflow(comfyPage.page, 'alpha-workflow')).toBeVisible()

    await findWorkflow(comfyPage.page, 'alpha-workflow').click({
      button: 'right'
    })
    await comfyPage.contextMenu.clickMenuItem('Delete')

    await expect(findWorkflow(comfyPage.page, 'alpha-workflow')).toBeHidden()
  })

  test('Deleting during search does not affect other matched results', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.workflowsTab
    await tab.open()

    const searchInput = comfyPage.page.getByPlaceholder('Search Workflow...')
    await searchInput.fill('workflow')

    await expect(findWorkflow(comfyPage.page, 'alpha-workflow')).toBeVisible()
    await expect(findWorkflow(comfyPage.page, 'beta-workflow')).toBeVisible()
    await expect(findWorkflow(comfyPage.page, 'gamma-workflow')).toBeVisible()

    await findWorkflow(comfyPage.page, 'alpha-workflow').click({
      button: 'right'
    })
    await comfyPage.contextMenu.clickMenuItem('Delete')

    await expect(findWorkflow(comfyPage.page, 'alpha-workflow')).toBeHidden()
    await expect(findWorkflow(comfyPage.page, 'beta-workflow')).toBeVisible()
    await expect(findWorkflow(comfyPage.page, 'gamma-workflow')).toBeVisible()
  })

  test('Clearing search after deleting during search shows correct workflows', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.workflowsTab
    await tab.open()

    const searchInput = comfyPage.page.getByPlaceholder('Search Workflow...')
    await searchInput.fill('alpha')
    await expect(findWorkflow(comfyPage.page, 'alpha-workflow')).toBeVisible()

    await findWorkflow(comfyPage.page, 'alpha-workflow').click({
      button: 'right'
    })
    await comfyPage.contextMenu.clickMenuItem('Delete')

    // Clear search — browse view should not show deleted workflow
    await searchInput.fill('')
    await expect(tab.getPersistedItem('beta-workflow')).toBeVisible()
    await expect(tab.getPersistedItem('gamma-workflow')).toBeVisible()
    await expect(tab.getPersistedItem('alpha-workflow')).toBeHidden()
  })
})
