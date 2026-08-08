import { expect, mergeTests } from '@playwright/test'

import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { makeTemplate } from '@e2e/fixtures/data/templateFixtures'
import { withTemplates } from '@e2e/fixtures/helpers/TemplateHelper'
import { templateApiFixture } from '@e2e/fixtures/templateApiFixture'

const test = mergeTests(comfyPageFixture, templateApiFixture)

test.describe('Template filter search', () => {
  test.beforeEach(async ({ templateApi }) => {
    templateApi.configure(
      withTemplates([
        makeTemplate({ name: 'flux', title: 'Flux', models: ['Flux'] }),
        makeTemplate({ name: 'sdxl', title: 'SDXL', models: ['SDXL'] })
      ])
    )
    await templateApi.mock()
  })

  test('accepts input in a filter dropdown search', async ({ comfyPage }) => {
    await comfyPage.command.executeCommand('Comfy.BrowseTemplates')
    await expect(comfyPage.templates.content).toBeVisible()

    await comfyPage.templatesDialog.openFilters()
    await comfyPage.templatesDialog.modelFilter.click()
    await expect(comfyPage.templatesDialog.modelFilterSearch).toBeVisible()

    await comfyPage.templatesDialog.modelFilterSearch.click()
    await expect(comfyPage.templatesDialog.modelFilterSearch).toBeFocused()
    await comfyPage.templatesDialog.modelFilterSearch.pressSequentially('flux')

    await expect(comfyPage.templatesDialog.modelFilterSearch).toHaveValue(
      'flux'
    )
    await expect(
      comfyPage.page.getByRole('option', { name: 'Flux' })
    ).toBeVisible()
    await expect(
      comfyPage.page.getByRole('option', { name: 'SDXL' })
    ).toBeHidden()
  })
})
