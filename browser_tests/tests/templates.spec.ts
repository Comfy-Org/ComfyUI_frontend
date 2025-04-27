import { Page, expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'

async function checkTemplateFileExists(
  page: Page,
  filename: string
): Promise<boolean> {
  const response = await page.request.head(
    new URL(`/templates/${filename}`, page.url()).toString()
  )
  return response.ok()
}

test.describe('Templates', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.setSetting('Comfy.UseNewMenu', 'Top')
    await comfyPage.setSetting('Comfy.Workflow.ShowMissingModelsWarning', false)
  })

  test('should have a JSON workflow file for each template', async ({
    comfyPage
  }) => {
    test.slow()
    const templates = await comfyPage.templates.getAllTemplates()
    for (const template of templates) {
      const exists = await checkTemplateFileExists(
        comfyPage.page,
        `${template.name}.json`
      )
      expect(exists, `Missing workflow: ${template.name}`).toBe(true)
    }
  })

  test('should have all required thumbnail media for each template', async ({
    comfyPage
  }) => {
    test.slow()
    const templates = await comfyPage.templates.getAllTemplates()
    for (const template of templates) {
      const { name, mediaSubtype, thumbnailVariant } = template
      const baseMedia = `${name}-1.${mediaSubtype}`

      // Check base thumbnail
      const baseExists = await checkTemplateFileExists(
        comfyPage.page,
        baseMedia
      )
      expect(baseExists, `Missing base thumbnail: ${baseMedia}`).toBe(true)

      // Check second thumbnail for variants that need it
      if (
        thumbnailVariant === 'compareSlider' ||
        thumbnailVariant === 'hoverDissolve'
      ) {
        const secondMedia = `${name}-2.${mediaSubtype}`
        const secondExists = await checkTemplateFileExists(
          comfyPage.page,
          secondMedia
        )
        expect(
          secondExists,
          `Missing second thumbnail: ${secondMedia} required for ${thumbnailVariant}`
        ).toBe(true)
      }
    }
  })

  test('Can load template workflows', async ({ comfyPage }) => {
    // Clear the workflow
    await comfyPage.menu.workflowsTab.open()
    await comfyPage.executeCommand('Comfy.NewBlankWorkflow')
    await expect(async () => {
      expect(await comfyPage.getGraphNodesCount()).toBe(0)
    }).toPass({ timeout: 250 })

    // Load a template
    await comfyPage.executeCommand('Comfy.BrowseTemplates')
    await expect(comfyPage.templates.content).toBeVisible()
    await comfyPage.templates.loadTemplate('default')
    await expect(comfyPage.templates.content).toBeHidden()

    // Ensure we now have some nodes
    await expect(async () => {
      expect(await comfyPage.getGraphNodesCount()).toBeGreaterThan(0)
    }).toPass({ timeout: 250 })
  })

  test('dialog should be automatically shown to first-time users', async ({
    comfyPage
  }) => {
    // Set the tutorial as not completed to mark the user as a first-time user
    await comfyPage.setSetting('Comfy.TutorialCompleted', false)

    // Load the page
    await comfyPage.setup({ clearStorage: true })

    // Expect the templates dialog to be shown
    expect(await comfyPage.templates.content.isVisible()).toBe(true)
  })

  test('Uses title field as fallback when the key is not found in locales', async ({
    comfyPage
  }) => {
    // Capture request for the index.json
    await comfyPage.page.route('**/templates/index.json', async (route, _) => {
      // Add a new template that won't have a translation pre-generated
      const response = [
        {
          moduleName: 'default',
          title: 'FALLBACK CATEGORY',
          type: 'image',
          templates: [
            {
              name: 'unknown_key_has_no_translation_available',
              title: 'FALLBACK TEMPLATE NAME',
              mediaType: 'image',
              mediaSubtype: 'webp',
              description: 'No translations found'
            }
          ]
        }
      ]
      await route.fulfill({
        status: 200,
        body: JSON.stringify(response),
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store'
        }
      })
    })

    // Load the templates dialog
    await comfyPage.executeCommand('Comfy.BrowseTemplates')

    // Expect the title to be used as fallback for template cards
    await expect(
      comfyPage.templates.content.getByText('FALLBACK TEMPLATE NAME')
    ).toBeVisible()

    // Expect the title to be used as fallback for the template categories
    await expect(comfyPage.page.getByLabel('FALLBACK CATEGORY')).toBeVisible()
  })
})
