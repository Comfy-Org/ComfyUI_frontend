import { expect } from '@playwright/test'

import type { WorkflowTemplates } from '@/platform/workflow/templates/types/template'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

const MOCK_TEMPLATE_INDEX: WorkflowTemplates[] = [
  {
    moduleName: 'default',
    title: 'Test Templates',
    type: 'image',
    templates: [
      {
        name: 'test_template',
        title: 'Test Template',
        mediaType: 'image',
        mediaSubtype: 'webp',
        description: 'A test template for URL loading.'
      }
    ]
  }
]

const MOCK_WORKFLOW_JSON = {
  last_node_id: 2,
  last_link_id: 1,
  nodes: [
    {
      id: 1,
      type: 'KSampler',
      pos: [100, 100],
      size: [300, 200],
      outputs: [{ name: 'LATENT', type: 'LATENT', links: [1] }],
      properties: {}
    },
    {
      id: 2,
      type: 'EmptyLatentImage',
      pos: [500, 100],
      size: [300, 200],
      inputs: [{ name: 'LATENT', type: 'LATENT', link: 1 }],
      properties: {}
    }
  ],
  links: [[1, 1, 0, 2, 0, 'LATENT']],
  groups: [],
  config: {},
  extra: {},
  version: 0.4
}

test.describe('Template URL loading spinner', { tag: ['@workflow'] }, () => {
  test('shows spinner while loading template from URL param', async ({
    comfyPage
  }) => {
    const blockUIMask = comfyPage.page.locator('.p-blockui-mask')

    await comfyPage.page.route('**/templates/index.json', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify(MOCK_TEMPLATE_INDEX),
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store'
        }
      })
    })

    let resolveTemplate: (() => void) | undefined
    const templateDelay = new Promise<void>((resolve) => {
      resolveTemplate = resolve
    })

    await comfyPage.page.route(
      '**/templates/test_template.json',
      async (route) => {
        await templateDelay
        await route.fulfill({
          status: 200,
          body: JSON.stringify(MOCK_WORKFLOW_JSON),
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store'
          }
        })
      }
    )

    await comfyPage.page.goto(`${comfyPage.url}?template=test_template`)

    await expect(blockUIMask).toBeVisible({ timeout: 10_000 })

    resolveTemplate?.()

    await expect(blockUIMask).toBeHidden({ timeout: 30_000 })

    await comfyPage.page.waitForFunction(
      () => window.app && window.app.extensionManager
    )
  })

  test('dismisses spinner normally when no template param', async ({
    comfyPage
  }) => {
    const blockUIMask = comfyPage.page.locator('.p-blockui-mask')

    await comfyPage.page.goto(comfyPage.url)

    await comfyPage.page.waitForFunction(
      () => window.app && window.app.extensionManager
    )

    await expect(blockUIMask).toBeHidden({ timeout: 30_000 })
  })
})
