import { expect, mergeTests } from '@playwright/test'

import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { makeTemplate } from '@e2e/fixtures/data/templateFixtures'
import { withTemplates } from '@e2e/fixtures/helpers/TemplateHelper'
import { templateApiFixture } from '@e2e/fixtures/templateApiFixture'

const test = mergeTests(comfyPageFixture, templateApiFixture)

/**
 * End-to-end guard that the templates filter sheet is on top and clickable.
 *
 * The original 1.47.10 stacking bug (#14063, #14131, #14351, #14397) hit the
 * modal's filter dropdowns when the shared modal z-index counter escalated
 * past their static z-3000; the mechanism is pinned deterministically in
 * useModalLiftedZIndex.test.ts. The templates browser is a sidebar panel now
 * and its filters are a flat popover sheet, but the user-visible guarantee is
 * the same: the filter controls must paint above the rest of the UI and
 * clicks must land on them.
 */
test.describe('Template filter dropdown stacking', () => {
  test.beforeEach(async ({ comfyPage, templateApi }) => {
    await comfyPage.settings.setSetting('Comfy.Templates.SelectedModels', [])
    templateApi.configure(
      withTemplates([
        makeTemplate({ name: 'wan-1', title: 'Wan One', models: ['Wan 2.2'] }),
        makeTemplate({ name: 'flux-1', title: 'Flux One', models: ['Flux'] })
      ])
    )
    await templateApi.mock()
    // The template index is fetched during app startup, so the routes have to be
    // in place before the app loads or the store keeps its unmocked contents.
    await comfyPage.setup()
  })

  test('renders filter chips above the panel and keeps them clickable', async ({
    comfyPage
  }) => {
    await comfyPage.command.executeCommand('Comfy.BrowseTemplates')
    await expect(comfyPage.templates.content).toBeVisible()

    await comfyPage.templatesDialog.openFilters()

    const chip = comfyPage.templatesDialog.filterSheet.getByRole('button', {
      name: 'Wan 2.2',
      exact: true
    })
    await expect(chip).toBeVisible()

    // Visibility alone passes even when another surface covers the chip, so
    // hit-test its centre: whatever paints there must belong to the chip.
    const chipIsOnTop = await chip.evaluate((el) => {
      const { left, top, width, height } = el.getBoundingClientRect()
      const topMost = document.elementFromPoint(
        left + width / 2,
        top + height / 2
      )
      return !!topMost && el.contains(topMost)
    })
    expect(chipIsOnTop).toBe(true)

    // The user-facing consequence: the click toggles the filter.
    await chip.click()
    await comfyPage.templatesDialog.closeFilters()

    await expect(comfyPage.templates.allTemplateCards).toHaveCount(1)
  })
})
