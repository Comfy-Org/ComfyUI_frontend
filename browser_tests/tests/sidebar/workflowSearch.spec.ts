import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../../fixtures/ComfyPage'

test.describe('Workflow sidebar - search', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.setup()

    // Save two workflows with distinct names for search testing
    await comfyPage.menu.topbar.saveWorkflow('alpha-workflow')
    await comfyPage.command.executeCommand('Comfy.NewBlankWorkflow')
    await comfyPage.menu.topbar.saveWorkflow('beta-workflow')
  })

  test('Search input is visible in workflows tab', async ({ comfyPage }) => {
    const tab = comfyPage.menu.workflowsTab
    await tab.open()

    const searchInput = comfyPage.page.getByPlaceholder('Search Workflow...')
    await expect(searchInput).toBeVisible()
  })

  test('Search filters saved workflows by name', async ({ comfyPage }) => {
    const tab = comfyPage.menu.workflowsTab
    await tab.open()

    const searchInput = comfyPage.page.getByPlaceholder('Search Workflow...')
    await searchInput.fill('alpha')

    // alpha-workflow should be visible, beta-workflow should not
    await expect(tab.getPersistedItem('alpha-workflow')).toBeVisible({
      timeout: 5000
    })
    await expect(tab.getPersistedItem('beta-workflow')).not.toBeVisible()
  })

  test('Clearing search restores all workflows', async ({ comfyPage }) => {
    const tab = comfyPage.menu.workflowsTab
    await tab.open()

    const searchInput = comfyPage.page.getByPlaceholder('Search Workflow...')
    await searchInput.fill('alpha')
    await expect(tab.getPersistedItem('beta-workflow')).not.toBeVisible()

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

    await expect(tab.getPersistedItem('alpha-workflow')).not.toBeVisible()
    await expect(tab.getPersistedItem('beta-workflow')).not.toBeVisible()
  })
})
