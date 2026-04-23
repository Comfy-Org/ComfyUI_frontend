import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { createMockNodeDefinitions } from '@e2e/fixtures/data/nodeDefinitions'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'

function buildMockApiNode(
  name: string,
  displayName: string,
  expr: string
): ComfyNodeDef {
  return {
    name,
    display_name: displayName,
    description: 'Test API node for pricing badge checks',
    category: 'testing',
    input: { required: { image: ['IMAGE', {}] } },
    output: ['IMAGE'],
    output_is_list: [false],
    output_name: ['IMAGE'],
    output_node: false,
    python_module: 'test_nodes',
    deprecated: false,
    experimental: false,
    api_node: true,
    price_badge: {
      engine: 'jsonata',
      expr,
      depends_on: { widgets: [], inputs: [], input_groups: [] }
    }
  }
}

const MOCK_API_NODES: Record<string, ComfyNodeDef> = {
  TestCreditApiNodeUsd: buildMockApiNode(
    'TestCreditApiNodeUsd',
    'Test Credit API Node USD',
    '{"type":"usd","usd":0.05}'
  ),
  TestCreditApiNodeRange: buildMockApiNode(
    'TestCreditApiNodeRange',
    'Test Credit API Node Range',
    '{"type":"range_usd","min_usd":0.01,"max_usd":0.10}'
  ),
  TestCreditApiNodeList: buildMockApiNode(
    'TestCreditApiNodeList',
    'Test Credit API Node List',
    '{"type":"list_usd","usd":[0.02,0.05]}'
  )
}

const testWithMockedObjectInfo = test.extend<{ mockApiNodes: void }>({
  mockApiNodes: [
    async ({ page }, use) => {
      const nodeDefs = createMockNodeDefinitions(MOCK_API_NODES)
      const pattern = '**/api/object_info'

      await page.route(pattern, (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(nodeDefs)
        })
      )

      await use()
      await page.unroute(pattern)
    },
    { auto: true }
  ]
})

testWithMockedObjectInfo.describe(
  'Credit helper pricing badges',
  { tag: '@node' },
  () => {
    testWithMockedObjectInfo.use({ locale: 'en-US' })

    testWithMockedObjectInfo.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
      await comfyPage.settings.setSetting('Comfy.NodeSearchBoxImpl', 'default')
      await comfyPage.settings.setSetting(
        'Comfy.LinkRelease.Action',
        'search box'
      )
      await comfyPage.settings.setSetting(
        'Comfy.LinkRelease.ActionShift',
        'search box'
      )
    })

    testWithMockedObjectInfo(
      'shows USD pricing badge in node search',
      async ({ comfyPage }) => {
        await comfyPage.canvasOps.doubleClick()
        await expect(comfyPage.searchBoxV2.input).toBeVisible()

        await comfyPage.searchBoxV2.input.fill('TestCreditApiNodeUsd')
        const result = comfyPage.searchBoxV2.results
          .filter({ hasText: 'Test Credit API Node USD' })
          .first()
        await expect(result).toBeVisible()

        const badge = result
          .getByTestId('badge-pill')
          .filter({ has: comfyPage.page.locator('i[class*="comfy--credits"]') })
        await expect(badge).toBeVisible()
        await expect
          .poll(async () => (await badge.textContent())?.trim() ?? '')
          .toContain('10.6')
      }
    )

    testWithMockedObjectInfo(
      'shows pricing badge in VueNodes node header',
      async ({ comfyPage }) => {
        await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
        await comfyPage.vueNodes.waitForNodes()

        const nodeId = await comfyPage.page.evaluate(() => {
          const node = window.LiteGraph!.createNode('TestCreditApiNodeUsd')
          window.app!.graph.add(node!)
          return node!.id
        })

        const header = comfyPage.page.locator(
          `[data-testid="node-header-${nodeId}"]`
        )
        await expect(header).toBeVisible()
        const priceBadge = header.locator(
          'span:has(> i[class*="lucide--component"])'
        )
        await expect
          .poll(async () => (await priceBadge.textContent())?.trim() ?? '')
          .toContain('10.6')
      }
    )

    testWithMockedObjectInfo(
      'shows range and list pricing formats in node search',
      async ({ comfyPage }) => {
        await comfyPage.canvasOps.doubleClick()
        await expect(comfyPage.searchBoxV2.input).toBeVisible()

        await comfyPage.searchBoxV2.input.fill('TestCreditApiNode')

        const rangeResult = comfyPage.searchBoxV2.results
          .filter({ hasText: 'Test Credit API Node Range' })
          .first()
        const listResult = comfyPage.searchBoxV2.results
          .filter({ hasText: 'Test Credit API Node List' })
          .first()

        await expect(rangeResult).toBeVisible()
        await expect(listResult).toBeVisible()

        const creditsBadgeFilter = {
          has: comfyPage.page.locator('i[class*="comfy--credits"]')
        }
        const rangeBadge = rangeResult
          .getByTestId('badge-pill')
          .filter(creditsBadgeFilter)
        const listBadge = listResult
          .getByTestId('badge-pill')
          .filter(creditsBadgeFilter)

        await expect(rangeBadge).toBeVisible()
        await expect(listBadge).toBeVisible()
        await expect
          .poll(async () => (await rangeBadge.textContent())?.trim() ?? '')
          .toContain('2.1-21.1')
        await expect
          .poll(async () => (await listBadge.textContent())?.trim() ?? '')
          .toContain('4.2/10.6')
      }
    )
  }
)
