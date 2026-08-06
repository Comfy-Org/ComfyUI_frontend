import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { getWav } from '@e2e/fixtures/components/AudioPreview'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'
import { trackElementFlash } from '@e2e/fixtures/utils/flashDetector'

async function checkTemplateFileExists(
  page: Page,
  filename: string
): Promise<boolean> {
  const response = await page.request.head(
    new URL(`/templates/${filename}`, page.url()).toString()
  )
  return response.ok()
}

test.describe('Templates', { tag: ['@slow', '@workflow'] }, () => {
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

  // Flaky: /templates is proxied to an external server, so thumbnail
  // availability varies across CI runs.
  // FIX: Make hermetic — fixture index.json and thumbnail responses via
  // page.route(), and change checkTemplateFileExists to use browser-context
  // fetch (page.request.head bypasses Playwright routing).
  // https://github.com/Comfy-Org/ComfyUI_frontend/issues/3992
  // oxlint-disable-next-line playwright/no-skipped-test -- https://github.com/Comfy-Org/ComfyUI_frontend/issues/3992
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
    await comfyPage.command.executeCommand('Comfy.NewBlankWorkflow')
    await expect.poll(() => comfyPage.nodeOps.getGraphNodesCount()).toBe(0)

    // Load a template
    await comfyPage.command.executeCommand('Comfy.BrowseTemplates')
    await expect(comfyPage.templates.content).toBeVisible()

    // Categories are chips inside the panel's filter sheet
    await comfyPage.templatesDialog.toggleFilterChip('Getting Started')
    await comfyPage.templatesDialog.closeFilters()
    await comfyPage.templates.loadTemplate('default')
    await expect(comfyPage.templates.content).toBeHidden()

    // Ensure we now have some nodes
    await expect
      .poll(() => comfyPage.nodeOps.getGraphNodesCount())
      .toBeGreaterThan(0)
  })

  test('dialog should be automatically shown to first-time users', async ({
    comfyPage
  }) => {
    // Set the tutorial as not completed to mark the user as a first-time user
    await comfyPage.settings.setSetting('Comfy.TutorialCompleted', false)

    // Load the page
    await comfyPage.setup({ clearStorage: true })

    // Expect the templates dialog to be shown
    await expect(comfyPage.templates.content).toBeVisible()
  })

  test('dialog should not be shown when first-time user opens a shared workflow link', async ({
    comfyPage
  }) => {
    await comfyPage.page.route(
      '**/workflows/published/test-share-id',
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            share_id: 'test-share-id',
            workflow_id: 'wf-1',
            name: 'Shared Workflow',
            listed: true,
            publish_time: new Date().toISOString(),
            workflow_json: {
              version: 0.4,
              nodes: [],
              links: [],
              groups: [],
              config: {},
              extra: {}
            },
            assets: []
          })
        })
      }
    )

    await comfyPage.settings.setSetting('Comfy.TutorialCompleted', false)

    await comfyPage.setup({
      clearStorage: true,
      url: '/?share=test-share-id'
    })

    await expect(
      comfyPage.page.getByTestId(TestIds.dialogs.openSharedWorkflowTitle)
    ).toBeVisible()

    await expect(comfyPage.templates.content).toBeHidden()
  })

  test('Uses proper locale files for templates', async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.Locale', 'fr')

    await comfyPage.command.executeCommand('Comfy.BrowseTemplates')

    const panel = comfyPage.templatesDialog.filterByHeading('Modèles')
    await expect(panel).toBeVisible()

    // Validate that French-localized category names from the templates index
    // are rendered as chips in the filter sheet
    await comfyPage.templatesDialog.openFilters()
    await expect(
      comfyPage.templatesDialog.filterSheet.getByRole('button', {
        name: 'Tous les modèles',
        exact: true
      })
    ).toBeVisible()

    // Ensure the English fallback copy is not shown anywhere
    await expect(
      comfyPage.page.getByText('All Templates', { exact: true })
    ).toHaveCount(0)
  })

  test('Falls back to English templates when locale file not found', async ({
    comfyPage
  }) => {
    // Pick a shipped LTR locale and simulate its template index returning 404.
    // (Previously this test used 'de', but unsupported locales are now
    // clamped to 'en' at boot so they never hit the template fallback path.
    // 'fa' would also work but flips document.dir to rtl, which can leak
    // into adjacent specs in the same worker.)
    const locale = 'tr'

    await comfyPage.page.route(
      `**/templates/index.${locale}.json`,
      async (route) => {
        await route.fulfill({
          status: 404,
          headers: { 'Content-Type': 'text/plain' },
          body: 'Not Found'
        })
      }
    )

    await comfyPage.page.route('**/templates/index.json', (route) =>
      route.continue()
    )

    // Load the catalog first, then switch locale. The other order races: the
    // index may be fetched either by the browser opening or by the locale
    // watcher, depending on how quickly setActiveLocale resolves, and a fetch
    // that lands before the locale has actually changed never asks for the
    // localized file at all. Loading first leaves the refetch as the only
    // thing the locale change can trigger.
    await comfyPage.command.executeCommand('Comfy.BrowseTemplates')
    await expect(comfyPage.templates.content).toBeVisible()

    const localeRequestPromise = comfyPage.page.waitForRequest(
      `**/templates/index.${locale}.json`
    )
    const englishRequestPromise = comfyPage.page.waitForRequest(
      '**/templates/index.json'
    )

    await comfyPage.settings.setSetting('Comfy.Locale', locale)

    const localeRequest = await localeRequestPromise
    const englishRequest = await englishRequestPromise

    expect(localeRequest.url()).toContain(`templates/index.${locale}.json`)
    expect(englishRequest.url()).toContain('templates/index.json')

    // Assert on rendered content, not just the container — the container
    // testid is present even when the dialog body is empty, which would let
    // a regression where the fallback fetch succeeds but no cards render
    // pass silently.
    await expect(comfyPage.templates.allTemplateCards.first()).toBeVisible()
  })

  test('template cards are dynamically sized and responsive', async ({
    comfyPage
  }) => {
    // Open templates dialog
    await comfyPage.command.executeCommand('Comfy.BrowseTemplates')
    await comfyPage.templates.content.waitFor({ state: 'visible' })

    const templateGrid = comfyPage.page.getByTestId(
      'template-workflows-content'
    )

    await comfyPage.templates.expectMinimumCardCount(1)
    await expect(templateGrid).toBeVisible()

    const mobileSize = { width: 640, height: 800 }
    await comfyPage.page.setViewportSize(mobileSize)
    await comfyPage.templates.expectMinimumCardCount(1)
    await expect(templateGrid).toBeVisible()

    const tabletSize = { width: 1024, height: 800 }
    await comfyPage.page.setViewportSize(tabletSize)
    await comfyPage.templates.expectMinimumCardCount(1)
    await expect(templateGrid).toBeVisible()
  })

  test(
    'filter sheet renders correctly',
    { tag: '@screenshot' },
    async ({ comfyPage }) => {
      await comfyPage.command.executeCommand('Comfy.BrowseTemplates')
      await expect(comfyPage.templates.content).toBeVisible()

      await comfyPage.templatesDialog.openFilters()

      // Screenshot the flat filter sheet (category/model/task/runs-on chips)
      const filterSheet = comfyPage.templatesDialog.filterSheet
      await expect(filterSheet).toBeVisible()
      await expect(filterSheet).toHaveScreenshot('template-filter-sheet.png', {
        mask: [comfyPage.page.locator('.p-toast')]
      })
    }
  )

  test(
    'template cards keep tag chips out of card chrome',
    { tag: '@screenshot' },
    async ({ comfyPage }) => {
      await comfyPage.page.route('**/templates/index.json', async (route) => {
        const response = [
          {
            moduleName: 'default',
            title: 'Test Templates',
            type: 'image',
            templates: [
              {
                name: 'tagged-template',
                title: 'Tagged Template',
                mediaType: 'image',
                mediaSubtype: 'webp',
                description: 'A template with tags.',
                tags: ['Relight', 'Image Edit']
              },
              {
                name: 'no-tags',
                title: 'No Tags',
                mediaType: 'image',
                mediaSubtype: 'webp',
                description: 'A template without tags.'
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

      await comfyPage.page.route('**/templates/**.webp', async (route) => {
        await route.fulfill({
          status: 200,
          path: 'browser_tests/assets/example.webp',
          headers: {
            'Content-Type': 'image/webp',
            'Cache-Control': 'no-store'
          }
        })
      })

      await comfyPage.command.executeCommand('Comfy.BrowseTemplates')
      await expect(comfyPage.templates.content).toBeVisible()

      const taggedCard = comfyPage.page.getByTestId(
        TestIds.templates.workflowCard('tagged-template')
      )
      await expect(taggedCard).toBeVisible()
      // Tags are search/filter data only: they must not render on the card
      await expect(taggedCard.getByText('Relight')).toHaveCount(0)
      await expect(taggedCard.getByText('Image Edit')).toHaveCount(0)

      const templateGrid = comfyPage.page.getByTestId(TestIds.templates.content)
      await expect(templateGrid).toHaveScreenshot(
        'template-cards-without-tag-chips.png'
      )
    }
  )

  test('Can open associated tutorial', async ({ comfyPage }) => {
    const tutorialUrl = 'https://comfyanonymous.github.io/ComfyUI_examples/'
    await comfyPage.page.route('**/templates/index.json', async (route) => {
      const response = [
        {
          moduleName: 'default',
          title: 'Test Templates',
          type: 'image',
          templates: [
            {
              name: 'template-with-tutorial',
              title: 'Template with a tutorial',
              mediaType: 'audio',
              mediaSubtype: 'wav',
              description: 'This template has a tutorial',
              tutorialUrl
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

    await comfyPage.page.route('**/templates/**.wav', async (route) => {
      await route.fulfill({
        status: 200,
        body: getWav(),
        headers: {
          'Content-Type': 'image/x-wav',
          'Cache-Control': 'no-store'
        }
      })
    })
    await comfyPage.command.executeCommand('Comfy.BrowseTemplates')
    const card = comfyPage.page.getByTestId(
      'template-workflow-template-with-tutorial'
    )
    await card.hover()
    const tutorialButton = card.getByRole('button', { name: 'See a tutorial' })
    await expect(tutorialButton).toBeVisible()
    const popupPromise = comfyPage.page.waitForEvent('popup', { timeout: 0 })
    await tutorialButton.click()
    const popup = await popupPromise
    expect(popup.url()).toEqual(tutorialUrl)
  })
})

test.describe(
  'Templates deeplink (new user)',
  { tag: ['@slow', '@workflow'] },
  () => {
    test('templates dialog never flashes when first-time user opens a template link', async ({
      comfyPage
    }) => {
      const templatesFlash = await trackElementFlash(
        comfyPage.page,
        TestIds.templates.content
      )

      await comfyPage.settings.setSetting('Comfy.TutorialCompleted', false)

      await comfyPage.setup({
        clearStorage: true,
        url: '/?template=default'
      })

      await expect
        .poll(() => comfyPage.nodeOps.getGraphNodesCount())
        .toBeGreaterThan(0)

      expect(await templatesFlash.hasFlashed()).toBe(false)
      await expect(comfyPage.templates.content).toBeHidden()
    })
  }
)
