import { expect, mergeTests } from '@playwright/test'

import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { makeTemplate } from '@e2e/fixtures/data/templateFixtures'
import { withTemplates } from '@e2e/fixtures/helpers/TemplateHelper'
import { templateApiFixture } from '@e2e/fixtures/templateApiFixture'

const test = mergeTests(comfyPageFixture, templateApiFixture)

test.describe('Template filter dropdown stacking', () => {
  test.beforeEach(async ({ templateApi }) => {
    templateApi.configure(
      withTemplates([
        makeTemplate({ name: 'wan-1', title: 'Wan One', models: ['Wan 2.2'] }),
        makeTemplate({ name: 'flux-1', title: 'Flux One', models: ['Flux'] })
      ])
    )
    await templateApi.mock()
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

    const optionIsOnTop = await option.evaluate((el) => {
      const { left, top, width, height } = el.getBoundingClientRect()
      const topMost = document.elementFromPoint(
        left + width / 2,
        top + height / 2
      )
      return !!topMost && el.contains(topMost)
    })
    expect(optionIsOnTop).toBe(true)

    await option.click()
    await comfyPage.page.keyboard.press('Escape')

    await expect(comfyPage.templates.allTemplateCards).toHaveCount(1)
  })
})
