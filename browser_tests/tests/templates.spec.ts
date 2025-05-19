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

  test('template cards are dynamically sized and responsive', async ({
    comfyPage
  }) => {
    // Open templates dialog
    await comfyPage.executeCommand('Comfy.BrowseTemplates')
    await expect(comfyPage.templates.content).toBeVisible()

    // Wait for at least one template card to appear
    await expect(comfyPage.page.locator('.template-card').first()).toBeVisible({
      timeout: 5000
    })

    // Take snapshot of the template grid
    const templateGrid = comfyPage.templates.content.locator('.grid').first()
    await expect(templateGrid).toBeVisible()
    await expect(templateGrid).toHaveScreenshot('template-grid-desktop.png')

    // Check cards at mobile viewport size
    await comfyPage.page.setViewportSize({ width: 640, height: 800 })
    await expect(templateGrid).toBeVisible()
    await expect(templateGrid).toHaveScreenshot('template-grid-mobile.png')

    // Check cards at tablet size
    await comfyPage.page.setViewportSize({ width: 1024, height: 800 })
    await expect(templateGrid).toBeVisible()
    await expect(templateGrid).toHaveScreenshot('template-grid-tablet.png')
  })

  test('hover effects work on template cards', async ({ comfyPage }) => {
    // Open templates dialog
    await comfyPage.executeCommand('Comfy.BrowseTemplates')
    await expect(comfyPage.templates.content).toBeVisible()

    // Get a template card
    const firstCard = comfyPage.page.locator('.template-card').first()
    await expect(firstCard).toBeVisible({ timeout: 5000 })

    // Take snapshot before hover
    await expect(firstCard).toHaveScreenshot('template-card-before-hover.png')

    // Hover over the card
    await firstCard.hover()

    // Take snapshot after hover to verify hover effect
    await expect(firstCard).toHaveScreenshot('template-card-after-hover.png')
  })

  test('template cards descriptions adjust height dynamically', async ({
    comfyPage
  }) => {
    // Setup test by intercepting templates response to inject cards with varying description lengths
    await comfyPage.page.route('**/templates/index.json', async (route, _) => {
      const response = [
        {
          moduleName: 'default',
          title: 'Test Templates',
          type: 'image',
          templates: [
            {
              name: 'short-description',
              title: 'Short Description',
              mediaType: 'image',
              mediaSubtype: 'webp',
              description: 'This is a short description.'
            },
            {
              name: 'medium-description',
              title: 'Medium Description',
              mediaType: 'image',
              mediaSubtype: 'webp',
              description:
                'This is a medium length description that should take up two lines on most displays.'
            },
            {
              name: 'long-description',
              title: 'Long Description',
              mediaType: 'image',
              mediaSubtype: 'webp',
              description:
                'This is a much longer description that should definitely wrap to multiple lines. It contains enough text to demonstrate how the cards handle varying amounts of content while maintaining a consistent layout grid.'
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

    // Mock the thumbnail images to avoid 404s
    await comfyPage.page.route('**/templates/**.webp', async (route) => {
      const headers = {
        'Content-Type': 'image/webp',
        'Cache-Control': 'no-store'
      }
      await route.fulfill({
        status: 200,
        path: 'browser_tests/assets/example.webp',
        headers
      })
    })

    // Open templates dialog
    await comfyPage.executeCommand('Comfy.BrowseTemplates')
    await expect(comfyPage.templates.content).toBeVisible()

    // Verify cards are visible with varying content lengths
    await expect(
      comfyPage.page.getByText('This is a short description.')
    ).toBeVisible({ timeout: 5000 })
    await expect(
      comfyPage.page.getByText('This is a medium length description')
    ).toBeVisible({ timeout: 5000 })
    await expect(
      comfyPage.page.getByText('This is a much longer description')
    ).toBeVisible({ timeout: 5000 })

    // Take snapshot of a grid with specific cards
    const templateGrid = comfyPage.templates.content
      .locator('.grid:has-text("Short Description")')
      .first()
    await expect(templateGrid).toBeVisible()
    await expect(templateGrid).toHaveScreenshot(
      'template-grid-varying-content.png'
    )
  })
})
