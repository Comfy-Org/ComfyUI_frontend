import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../../fixtures/ComfyPage'

test.describe('Workflow sidebar - search', () => {
  // Use unique names per worker to avoid overwrite dialogs across parallel tests
  let nameA: string
  let nameB: string

  test.beforeEach(async ({ comfyPage }, testInfo) => {
    const suffix = testInfo.parallelIndex
    nameA = `alpha-wf-${suffix}`
    nameB = `beta-wf-${suffix}`

    await comfyPage.setup()

    await comfyPage.menu.topbar.saveWorkflow(nameA)
    await comfyPage.command.executeCommand('Comfy.NewBlankWorkflow')
    await comfyPage.menu.topbar.saveWorkflow(nameB)
  })

  /** Locate a workflow label in whatever panel is visible (browse or search). */
  function findWorkflow(comfyPage: { page: Page }, name: string) {
    return comfyPage.page
      .getByTestId('workflows-sidebar')
      .locator('.node-label', { hasText: name })
  }

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

    await expect(findWorkflow(comfyPage, nameA)).toBeVisible({ timeout: 5000 })
    await expect(findWorkflow(comfyPage, nameB)).not.toBeVisible()
  })

  test('Clearing search restores all workflows', async ({ comfyPage }) => {
    const tab = comfyPage.menu.workflowsTab
    await tab.open()

    const searchInput = comfyPage.page.getByPlaceholder('Search Workflow...')
    await searchInput.fill('alpha')
    await expect(findWorkflow(comfyPage, nameB)).not.toBeVisible()

    await searchInput.fill('')

    // After clearing, the browse panel renders again
    await expect(tab.getPersistedItem(nameA)).toBeVisible({ timeout: 5000 })
    await expect(tab.getPersistedItem(nameB)).toBeVisible()
  })

  test('Search with no matches shows empty results', async ({ comfyPage }) => {
    const tab = comfyPage.menu.workflowsTab
    await tab.open()

    const searchInput = comfyPage.page.getByPlaceholder('Search Workflow...')
    await searchInput.fill('nonexistent_xyz')

    await expect(findWorkflow(comfyPage, nameA)).not.toBeVisible()
    await expect(findWorkflow(comfyPage, nameB)).not.toBeVisible()
  })
})
