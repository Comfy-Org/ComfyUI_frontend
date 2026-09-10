import { expect, mergeTests } from '@playwright/test'

import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { makeTemplate } from '@e2e/fixtures/data/templateFixtures'
import { withTemplates } from '@e2e/fixtures/helpers/TemplateHelper'
import { templateApiFixture } from '@e2e/fixtures/templateApiFixture'

const test = mergeTests(comfyPageFixture, templateApiFixture)

/**
 * End-to-end guard that the templates filter options are on top and clickable.
 *
 * This does NOT reproduce the 1.47.10 stacking bug (#14063, #14131, #14351,
 * #14397): that needed the shared modal counter to have escalated past the
 * dropdown's static z-3000 (reporters saw 7306), whereas a freshly opened
 * dialog only reaches ~1702, so the broken build passes this test. The
 * mechanism is pinned deterministically in useModalLiftedZIndex.test.ts; this
 * covers the user-visible behaviour those unit tests cannot see.
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
    // oxlint-disable-next-line comfy/no-comfy-page-setup-call -- pre-existing call, migration tracked in #16859; not fixed in this pass
    await comfyPage.setup()
  })

  test('renders filter options above the dialog and keeps them clickable', async ({
    comfyPage
  }) => {
    await comfyPage.command.executeCommand('Comfy.BrowseTemplates')
    await expect(comfyPage.templates.content).toBeVisible()

    await comfyPage.templatesDialog.openFilters()
    await comfyPage.templatesDialog.modelFilter.click()

    const option = comfyPage.page.getByRole('option', { name: 'Wan 2.2' })
    await expect(option).toBeVisible()

    // Visibility alone passes even when the dialog covers the option, so hit-test
    // the option's centre: whatever paints there must belong to the option itself.
    const optionIsOnTop = await option.evaluate((el) => {
      const { left, top, width, height } = el.getBoundingClientRect()
      const topMost = document.elementFromPoint(
        left + width / 2,
        top + height / 2
      )
      return !!topMost && el.contains(topMost)
    })
    expect(optionIsOnTop).toBe(true)

    // The user-facing consequence: the click lands on the option, not the dialog.
    await option.click()
    await comfyPage.page.keyboard.press('Escape')

    await expect(comfyPage.templates.allTemplateCards).toHaveCount(1)
  })
})
