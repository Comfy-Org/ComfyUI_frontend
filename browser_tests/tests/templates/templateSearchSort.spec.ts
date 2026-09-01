import { expect, mergeTests } from '@playwright/test'

import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { makeTemplate } from '@e2e/fixtures/data/templateFixtures'
import { withTemplates } from '@e2e/fixtures/helpers/TemplateHelper'
import { templateApiFixture } from '@e2e/fixtures/templateApiFixture'

const test = mergeTests(comfyPageFixture, templateApiFixture)

/**
 * `useTemplateFiltering.test.ts` owns the sort semantics; these cover the wiring
 * it cannot reach, because `coordinateNavAndSort` and its two watchers live in
 * `WorkflowTemplateSelectorDialog.vue`. Those watchers mirror nav and sort for
 * browsing — the Popular category selects the Popular sort and moving off it
 * restores Default — which, once a search also defaults to Popular, would
 * discard the sort the user is looking at every time the category changed.
 */
test.describe('Template search sort', () => {
  test.beforeEach(async ({ comfyPage, templateApi }) => {
    await comfyPage.settings.setSetting('Comfy.Templates.SelectedModels', [])
    await comfyPage.settings.setSetting('Comfy.Templates.SelectedUseCases', [])
    await comfyPage.settings.setSetting('Comfy.Templates.SelectedRunsOn', [])
    await comfyPage.settings.setSetting('Comfy.Templates.SortBy', 'newest')

    templateApi.configure(
      withTemplates([
        makeTemplate({ name: 'wan-rare', title: 'Wan Rare', usage: 1 }),
        makeTemplate({ name: 'wan-common', title: 'Wan Common', usage: 9000 }),
        makeTemplate({ name: 'flux-other', title: 'Flux Other', usage: 5 })
      ])
    )
    await templateApi.mock()

    await comfyPage.command.executeCommand('Comfy.BrowseTemplates')
    await expect(comfyPage.templates.content).toBeVisible()
    await comfyPage.templatesDialog.openFilters()
  })

  test('defaults an active search to Popular and ranks matches by usage', async ({
    comfyPage
  }) => {
    const dialog = comfyPage.templatesDialog
    await expect(dialog.sortSelect).toHaveText('Newest')

    await dialog.searchInput.fill('wan')
    await expect(dialog.resultsCount).toHaveText(/Showing 2 of 3 templates/i)

    await expect(dialog.sortSelect).toHaveText('Popular')
    await expect(comfyPage.templates.allTemplateCards.first()).toContainText(
      'Wan Common'
    )
  })

  test('keeps the search sort when the category changes mid-search', async ({
    comfyPage
  }) => {
    const dialog = comfyPage.templatesDialog

    await dialog.searchInput.fill('wan')
    await expect(dialog.sortSelect).toHaveText('Popular')

    await dialog.navItem('Popular').click()
    await dialog.navItem('All Templates').click()
    await expect(dialog.sortSelect).toHaveText('Popular')

    await dialog.selectSortOption('Relevance')
    await expect(dialog.sortSelect).toHaveText('Relevance')

    await dialog.navItem('Popular').click()
    await expect(dialog.sortSelect).toHaveText('Relevance')
  })

  test('restores the persisted browse sort when the search is cleared', async ({
    comfyPage
  }) => {
    const dialog = comfyPage.templatesDialog

    await dialog.searchInput.fill('wan')
    await expect(dialog.sortSelect).toHaveText('Popular')

    await dialog.searchInput.fill('')
    await expect(dialog.sortSelect).toHaveText('Newest')
    await expect(dialog.resultsCount).toHaveText(/Showing 3 of 3 templates/i)
  })
})
