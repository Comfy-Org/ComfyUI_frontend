import { expect, mergeTests } from '@playwright/test'

import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { makeTemplate } from '@e2e/fixtures/data/templateFixtures'
import { withTemplates } from '@e2e/fixtures/helpers/TemplateHelper'
import { templateApiFixture } from '@e2e/fixtures/templateApiFixture'

const test = mergeTests(comfyPageFixture, templateApiFixture)

test.describe(
  'Cloud template routing',
  { tag: ['@cloud', '@workflow'] },
  () => {
    test.beforeEach(async ({ page, templateApi }) => {
      templateApi.configure(
        withTemplates([
          makeTemplate({
            name: 'cloud-direct',
            title: 'Cloud Direct Template'
          })
        ])
      )
      await templateApi.mock()
      await page.route('**/templates/cloud-direct.json', (route) =>
        route.fulfill({
          contentType: 'application/json',
          path: 'browser_tests/assets/nodes/single_ksampler.json'
        })
      )
    })

    test('loads a template without presenting Template Detail', async ({
      comfyPage
    }) => {
      await comfyPage.command.executeCommand('Comfy.BrowseTemplates')
      await expect(comfyPage.templates.content).toBeVisible()

      await comfyPage.templates.loadTemplate('cloud-direct')

      await expect(comfyPage.templates.content).toBeHidden()
      await expect
        .poll(() => comfyPage.nodeOps.getGraphNodesCount())
        .toBeGreaterThan(0)
      await expect(
        comfyPage.page.getByRole('article', {
          name: 'Cloud Direct Template'
        })
      ).toHaveCount(0)
    })
  }
)
