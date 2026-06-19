import { expect, mergeTests } from '@playwright/test'

import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { makeTemplate } from '@e2e/fixtures/data/templateFixtures'
import { withTemplates } from '@e2e/fixtures/helpers/TemplateHelper'
import { TestIds } from '@e2e/fixtures/selectors'
import { templateApiFixture } from '@e2e/fixtures/templateApiFixture'

const test = mergeTests(comfyPageFixture, templateApiFixture)

const PREFER_APP_TEMPLATES_KEY = 'Comfy.Onboarding.PreferAppTemplates'

test.describe('Template content type filter', { tag: '@workflow' }, () => {
  test.beforeEach(async ({ comfyPage, templateApi }) => {
    await comfyPage.settings.setSetting('Comfy.Templates.SelectedModels', [])
    await comfyPage.settings.setSetting('Comfy.Templates.SelectedUseCases', [])
    await comfyPage.settings.setSetting('Comfy.Templates.SelectedRunsOn', [])
    await comfyPage.settings.setSetting('Comfy.Templates.SortBy', 'default')
    await comfyPage.settings.setSetting('Comfy.Templates.ContentType', 'all')

    templateApi.configure(
      withTemplates([
        makeTemplate({ name: 'image-gen.app', title: 'Image Gen App' }),
        makeTemplate({ name: 'video-gen.app', title: 'Video Gen App' }),
        makeTemplate({ name: 'basic-graph', title: 'Basic Graph' })
      ])
    )
    await templateApi.mock()
  })

  test('shows app and graph templates by default', async ({ comfyPage }) => {
    await comfyPage.command.executeCommand('Comfy.BrowseTemplates')
    await expect(comfyPage.templates.content).toBeVisible()

    await expect(comfyPage.templates.allTemplateCards).toHaveCount(3)
  })

  test('App filter shows only .app templates', async ({ comfyPage }) => {
    await comfyPage.command.executeCommand('Comfy.BrowseTemplates')
    await expect(comfyPage.templates.content).toBeVisible()

    await comfyPage.templatesDialog.selectContentType('App')

    await expect(comfyPage.templates.allTemplateCards).toHaveCount(2)
    await expect(
      comfyPage.templatesDialog.root.getByTestId(
        TestIds.templates.workflowCard('basic-graph')
      )
    ).toHaveCount(0)
  })

  test('Graph filter excludes .app templates', async ({ comfyPage }) => {
    await comfyPage.command.executeCommand('Comfy.BrowseTemplates')
    await expect(comfyPage.templates.content).toBeVisible()

    await comfyPage.templatesDialog.selectContentType('Graph')

    await expect(comfyPage.templates.allTemplateCards).toHaveCount(1)
    await expect(
      comfyPage.templatesDialog.root.getByTestId(
        TestIds.templates.workflowCard('basic-graph')
      )
    ).toBeVisible()
  })

  test('user can switch back to All to see every template', async ({
    comfyPage
  }) => {
    await comfyPage.command.executeCommand('Comfy.BrowseTemplates')
    await expect(comfyPage.templates.content).toBeVisible()

    await comfyPage.templatesDialog.selectContentType('App')
    await expect(comfyPage.templates.allTemplateCards).toHaveCount(2)

    await comfyPage.templatesDialog.selectContentType('All')
    await expect(comfyPage.templates.allTemplateCards).toHaveCount(3)
  })

  test('onboarding prefers-app flag defaults the picker to App templates', async ({
    comfyPage
  }) => {
    await comfyPage.page.evaluate((key) => {
      localStorage.setItem(key, 'true')
    }, PREFER_APP_TEMPLATES_KEY)

    await comfyPage.command.executeCommand('Comfy.BrowseTemplates')
    await expect(comfyPage.templates.content).toBeVisible()

    await expect(comfyPage.templates.allTemplateCards).toHaveCount(2)
    await expect(
      comfyPage.templatesDialog.root.getByTestId(
        TestIds.templates.workflowCard('basic-graph')
      )
    ).toHaveCount(0)
  })
})
