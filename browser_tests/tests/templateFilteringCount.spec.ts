import { expect } from '@playwright/test'

import type { TemplateInfo } from '@/platform/workflow/templates/types/template'
import { TemplateIncludeOnDistributionEnum } from '@/platform/workflow/templates/types/template'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import {
  makeTemplate,
  mockTemplateIndex
} from '@e2e/fixtures/data/templateFixtures'
import { TestIds } from '@e2e/fixtures/selectors'

const Cloud = TemplateIncludeOnDistributionEnum.Cloud
const Desktop = TemplateIncludeOnDistributionEnum.Desktop
const Local = TemplateIncludeOnDistributionEnum.Local

test.describe(
  'Template distribution filtering count',
  { tag: '@cloud' },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
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
    })

    test('displayed count matches visible cards when distribution filter excludes templates', async ({
      comfyPage
    }) => {
      const templates: TemplateInfo[] = [
        makeTemplate({
          name: 'cloud-1',
          title: 'Cloud One',
          includeOnDistributions: [Cloud]
        }),
        makeTemplate({
          name: 'cloud-2',
          title: 'Cloud Two',
          includeOnDistributions: [Cloud]
        }),
        makeTemplate({
          name: 'desktop-hidden',
          title: 'Desktop Hidden',
          includeOnDistributions: [Desktop]
        }),
        makeTemplate({
          name: 'universal',
          title: 'Universal'
        })
      ]

      await comfyPage.page.route('**/templates/index.json', async (route) => {
        await route.fulfill({
          status: 200,
          body: JSON.stringify(mockTemplateIndex(templates)),
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store'
          }
        })
      })

      await comfyPage.command.executeCommand('Comfy.BrowseTemplates')
      await expect(comfyPage.templates.content).toBeVisible()

      await expect(comfyPage.templates.allTemplateCards).toHaveCount(3)

      const desktopCard = comfyPage.templatesDialog.root.getByTestId(
        TestIds.templates.workflowCard('desktop-hidden')
      )
      await expect(desktopCard).toHaveCount(0)
    })

    test('filtered count reflects distribution + model filter together', async ({
      comfyPage
    }) => {
      const templates: TemplateInfo[] = [
        makeTemplate({
          name: 'wan-cloud-1',
          title: 'Wan Cloud 1',
          models: ['Wan 2.2'],
          includeOnDistributions: [Cloud]
        }),
        makeTemplate({
          name: 'wan-cloud-2',
          title: 'Wan Cloud 2',
          models: ['Wan 2.2'],
          includeOnDistributions: [Cloud]
        }),
        makeTemplate({
          name: 'wan-desktop',
          title: 'Wan Desktop',
          models: ['Wan 2.2'],
          includeOnDistributions: [Desktop]
        }),
        makeTemplate({
          name: 'flux-cloud',
          title: 'Flux Cloud',
          models: ['Flux'],
          includeOnDistributions: [Cloud]
        })
      ]

      await comfyPage.page.route('**/templates/index.json', async (route) => {
        await route.fulfill({
          status: 200,
          body: JSON.stringify(mockTemplateIndex(templates)),
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store'
          }
        })
      })

      await comfyPage.command.executeCommand('Comfy.BrowseTemplates')
      await expect(comfyPage.templates.content).toBeVisible()

      await comfyPage.templatesDialog.selectModelOption('Wan 2.2')

      await expect(comfyPage.templates.allTemplateCards).toHaveCount(2)

      const wanDesktopCard = comfyPage.templatesDialog.root.getByTestId(
        TestIds.templates.workflowCard('wan-desktop')
      )
      await expect(wanDesktopCard).toHaveCount(0)

      await expect(comfyPage.templatesDialog.resultsCount).toHaveText(
        /Showing 2 of 3 templates/i
      )
    })

    test('desktop-only templates never leak into DOM on cloud distribution', async ({
      comfyPage
    }) => {
      const templates: TemplateInfo[] = [
        makeTemplate({
          name: 'cloud-visible',
          title: 'Cloud Visible',
          includeOnDistributions: [Cloud]
        }),
        makeTemplate({
          name: 'desktop-leak-check',
          title: 'Desktop Leak Check',
          includeOnDistributions: [Desktop]
        }),
        makeTemplate({
          name: 'local-leak-check',
          title: 'Local Leak Check',
          includeOnDistributions: [Local]
        })
      ]

      await comfyPage.page.route('**/templates/index.json', async (route) => {
        await route.fulfill({
          status: 200,
          body: JSON.stringify(mockTemplateIndex(templates)),
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store'
          }
        })
      })

      await comfyPage.command.executeCommand('Comfy.BrowseTemplates')
      await expect(comfyPage.templates.content).toBeVisible()

      await expect(comfyPage.templates.allTemplateCards).toHaveCount(1)

      await expect(
        comfyPage.templatesDialog.root.getByTestId(
          TestIds.templates.workflowCard('cloud-visible')
        )
      ).toBeVisible()

      await expect(
        comfyPage.templatesDialog.root.getByTestId(
          TestIds.templates.workflowCard('desktop-leak-check')
        )
      ).toHaveCount(0)

      await expect(
        comfyPage.templatesDialog.root.getByTestId(
          TestIds.templates.workflowCard('local-leak-check')
        )
      ).toHaveCount(0)
    })

    test('templates without includeOnDistributions are visible on cloud', async ({
      comfyPage
    }) => {
      const templates: TemplateInfo[] = [
        makeTemplate({ name: 'unrestricted-1', title: 'Unrestricted 1' }),
        makeTemplate({ name: 'unrestricted-2', title: 'Unrestricted 2' }),
        makeTemplate({
          name: 'cloud-only',
          title: 'Cloud Only',
          includeOnDistributions: [Cloud]
        })
      ]

      await comfyPage.page.route('**/templates/index.json', async (route) => {
        await route.fulfill({
          status: 200,
          body: JSON.stringify(mockTemplateIndex(templates)),
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store'
          }
        })
      })

      await comfyPage.command.executeCommand('Comfy.BrowseTemplates')
      await expect(comfyPage.templates.content).toBeVisible()

      await expect(comfyPage.templates.allTemplateCards).toHaveCount(3)

      await expect(comfyPage.templatesDialog.resultsCount).toHaveText(
        /Showing 3 of 3 templates/i
      )
    })

    test('clear filters button resets to correct distribution-filtered total', async ({
      comfyPage
    }) => {
      const templates: TemplateInfo[] = [
        makeTemplate({
          name: 'wan-cloud',
          title: 'Wan Cloud',
          models: ['Wan 2.2'],
          includeOnDistributions: [Cloud]
        }),
        makeTemplate({
          name: 'flux-cloud',
          title: 'Flux Cloud',
          models: ['Flux'],
          includeOnDistributions: [Cloud]
        }),
        makeTemplate({
          name: 'wan-desktop',
          title: 'Wan Desktop',
          models: ['Wan 2.2'],
          includeOnDistributions: [Desktop]
        })
      ]

      await comfyPage.page.route('**/templates/index.json', async (route) => {
        await route.fulfill({
          status: 200,
          body: JSON.stringify(mockTemplateIndex(templates)),
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store'
          }
        })
      })

      await comfyPage.command.executeCommand('Comfy.BrowseTemplates')
      await expect(comfyPage.templates.content).toBeVisible()

      await comfyPage.templatesDialog.selectModelOption('Wan 2.2')

      await expect(comfyPage.templates.allTemplateCards).toHaveCount(1)

      const clearButton = comfyPage.templatesDialog.root.getByRole('button', {
        name: /Clear Filters/i
      })
      await clearButton.click()

      await expect(comfyPage.templates.allTemplateCards).toHaveCount(2)

      await expect(comfyPage.templatesDialog.resultsCount).toHaveText(
        /Showing 2 of 2 templates/i
      )
    })
  }
)
