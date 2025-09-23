import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

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

  // TODO: Re-enable this test once issue resolved
  // https://github.com/Comfy-Org/ComfyUI_frontend/issues/3992
  test.skip('should have all required thumbnail media for each template', async ({
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

    await comfyPage.page
      .locator(
        'nav > div:nth-child(2) > div > span:has-text("Getting Started")'
      )
      .click()
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

  test('Uses proper locale files for templates', async ({ comfyPage }) => {
    // Set locale to French before opening templates
    await comfyPage.setSetting('Comfy.Locale', 'fr')

    // Load the templates dialog and wait for the French index file request
    const requestPromise = comfyPage.page.waitForRequest(
      '**/templates/index.fr.json'
    )

    await comfyPage.executeCommand('Comfy.BrowseTemplates')

    const request = await requestPromise

    // Verify French index was requested
    expect(request.url()).toContain('templates/index.fr.json')

    await expect(comfyPage.templates.content).toBeVisible()
  })

  test('Falls back to English templates when locale file not found', async ({
    comfyPage
  }) => {
    // Set locale to a language that doesn't have a template file
    await comfyPage.setSetting('Comfy.Locale', 'de') // German - no index.de.json exists

    // Capture requests to verify fallback behavior
    let germanIndexRequested = false
    let englishIndexRequested = false

    await comfyPage.page.route('**/templates/index.de.json', async (route) => {
      germanIndexRequested = true
      // Return 404 to simulate missing file
      await route.fulfill({
        status: 404,
        headers: {
          'Content-Type': 'text/plain'
        },
        body: 'Not Found'
      })
    })

    await comfyPage.page.route('**/templates/index.json', async (route) => {
      englishIndexRequested = true
      // Return the actual English index file
      await route.continue()
    })

    // Load the templates dialog
    await comfyPage.executeCommand('Comfy.BrowseTemplates')
    await expect(comfyPage.templates.content).toBeVisible()

    // Verify German was attempted first, then English as fallback
    expect(germanIndexRequested).toBe(true)
    expect(englishIndexRequested).toBe(true)

    // Verify English titles are shown as fallback
    // Use a more specific selector to target the title heading
    await expect(
      comfyPage.templates.content.getByRole('heading', {
        name: 'Image Generation'
      })
    ).toBeVisible()

    // Also verify English descriptions
    await expect(
      comfyPage.templates.content.getByText(
        'Generate images from text prompts.'
      )
    ).toBeVisible()
  })

  test('template cards are dynamically sized and responsive', async ({
    comfyPage
  }) => {
    // Open templates dialog
    await comfyPage.executeCommand('Comfy.BrowseTemplates')
    await expect(comfyPage.templates.content).toBeVisible()

    const firstCard = comfyPage.page
      .locator('[data-testid^="template-workflow-"]')
      .first()
    await expect(firstCard).toBeVisible({ timeout: 5000 })

    // Get the template grid
    const templateGrid = comfyPage.page.locator(
      '[data-testid="template-workflows-content"]'
    )
    await expect(templateGrid).toBeVisible()

    // Check grid layout at desktop size (default)
    const desktopGridClass = await templateGrid.getAttribute('class')
    expect(desktopGridClass).toContain('grid')
    expect(desktopGridClass).toContain(
      'grid-cols-[repeat(auto-fill,minmax(16rem,1fr))]'
    )

    // Count visible cards at desktop size
    const desktopCardCount = await comfyPage.page
      .locator('[data-testid^="template-workflow-"]')
      .count()
    expect(desktopCardCount).toBeGreaterThan(0)

    // Check cards at mobile viewport size
    await comfyPage.page.setViewportSize({ width: 640, height: 800 })
    await expect(templateGrid).toBeVisible()
    // Grid should still be responsive at mobile size
    const mobileGridClass = await templateGrid.getAttribute('class')
    expect(mobileGridClass).toContain('grid')

    // Check cards at tablet size
    await comfyPage.page.setViewportSize({ width: 1024, height: 800 })
    await expect(templateGrid).toBeVisible()
    // Grid should still be responsive at tablet size
    const tabletGridClass = await templateGrid.getAttribute('class')
    expect(tabletGridClass).toContain('grid')
  })

  test('hover effects work on template cards', async ({ comfyPage }) => {
    // Open templates dialog
    await comfyPage.executeCommand('Comfy.BrowseTemplates')
    await expect(comfyPage.templates.content).toBeVisible()

    // Get a template card using data-testid
    const firstCard = comfyPage.page
      .locator('[data-testid^="template-workflow-"]')
      .first()
    await expect(firstCard).toBeVisible({ timeout: 5000 })

    // Check initial state - card should have transition classes
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

    // Wait for cards to load
    await expect(
      comfyPage.page.locator(
        '[data-testid="template-workflow-short-description"]'
      )
    ).toBeVisible({ timeout: 5000 })

    // Verify all three cards with different descriptions are visible
    const shortDescCard = comfyPage.page.locator(
      '[data-testid="template-workflow-short-description"]'
    )
    const mediumDescCard = comfyPage.page.locator(
      '[data-testid="template-workflow-medium-description"]'
    )
    const longDescCard = comfyPage.page.locator(
      '[data-testid="template-workflow-long-description"]'
    )

    await expect(shortDescCard).toBeVisible()
    await expect(mediumDescCard).toBeVisible()
    await expect(longDescCard).toBeVisible()

    // Verify descriptions are visible and have line-clamp class
    // The description is in a p tag with text-muted class
    const shortDesc = shortDescCard.locator('p.text-muted.line-clamp-2')
    const mediumDesc = mediumDescCard.locator('p.text-muted.line-clamp-2')
    const longDesc = longDescCard.locator('p.text-muted.line-clamp-2')

    await expect(shortDesc).toContainText('short description')
    await expect(mediumDesc).toContainText('medium length description')
    await expect(longDesc).toContainText('much longer description')

    // Verify grid layout maintains consistency
    const templateGrid = comfyPage.page.locator(
      '[data-testid="template-workflows-content"]'
    )
    await expect(templateGrid).toBeVisible()
    await expect(templateGrid).toHaveScreenshot(
      'template-grid-varying-content.png'
    )
  })
})
