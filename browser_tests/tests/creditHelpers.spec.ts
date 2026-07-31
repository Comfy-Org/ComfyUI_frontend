import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
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
      const pattern = '**/api/object_info'

      await page.route(pattern, (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_API_NODES)
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
      'shows API node indicator in node search results',
      async ({ comfyPage }) => {
        await comfyPage.canvasOps.doubleClick()
        await expect(comfyPage.searchBoxV2.input).toBeVisible()

        await comfyPage.searchBoxV2.input.fill('TestCreditApiNodeUsd')
        const result = comfyPage.searchBoxV2.results
          .filter({ hasText: 'Test Credit API Node USD' })
          .first()
        await expect(result).toBeVisible()

        // In search results with showDescription=true, the component icon is shown
        // (not the pricing badge). Verify the API node indicator is present.
        const apiIndicator = result.locator('i[class*="lucide--component"]')
        await expect(apiIndicator).toBeVisible()
      }
    )

    testWithMockedObjectInfo(
      'shows pricing badge in VueNodes node header',
      async ({ comfyPage }) => {
        await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
        await comfyPage.settings.setSetting(
          'Comfy.NodeBadge.ShowApiPricing',
          true
        )

        await comfyPage.nodeOps.clearGraph()

        const nodeId = await comfyPage.page.evaluate(() => {
          const node = window.LiteGraph!.createNode('TestCreditApiNodeUsd')
          window.app!.graph.add(node!)
          return node!.id
        })

        await comfyPage.vueNodes.waitForNodes(1)

        const header = comfyPage.page.locator(
          `[data-testid="node-header-${nodeId}"]`
        )
        await expect(header).toBeVisible()

        // CreditBadge uses icon-[lucide--component] for the credits icon
        const creditsBadge = header.locator('i[class*="lucide--component"]')
        await expect(creditsBadge).toBeVisible()

        // Verify the badge text contains expected credit amount (10.6 credits for $0.05)
        const badgeContainer = header.locator(
          'span:has(> i[class*="lucide--component"])'
        )
        await expect
          .poll(async () => (await badgeContainer.textContent())?.trim() ?? '')
          .toContain('10.6')
      }
    )

    testWithMockedObjectInfo(
      'shows range pricing in VueNodes node header',
      async ({ comfyPage }) => {
        await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
        await comfyPage.settings.setSetting(
          'Comfy.NodeBadge.ShowApiPricing',
          true
        )

        await comfyPage.nodeOps.clearGraph()

        const nodeId = await comfyPage.page.evaluate(() => {
          const node = window.LiteGraph!.createNode('TestCreditApiNodeRange')
          window.app!.graph.add(node!)
          return node!.id
        })

        await comfyPage.vueNodes.waitForNodes(1)

        const header = comfyPage.page.locator(
          `[data-testid="node-header-${nodeId}"]`
        )
        await expect(header).toBeVisible()

        // Verify range format (2.1-21.1 credits for $0.01-$0.10)
        const badgeContainer = header.locator(
          'span:has(> i[class*="lucide--component"])'
        )
        await expect
          .poll(async () => (await badgeContainer.textContent())?.trim() ?? '')
          .toContain('2.1-21.1')
      }
    )

    testWithMockedObjectInfo(
      'shows list pricing in VueNodes node header',
      async ({ comfyPage }) => {
        await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
        await comfyPage.settings.setSetting(
          'Comfy.NodeBadge.ShowApiPricing',
          true
        )

        await comfyPage.nodeOps.clearGraph()

        const nodeId = await comfyPage.page.evaluate(() => {
          const node = window.LiteGraph!.createNode('TestCreditApiNodeList')
          window.app!.graph.add(node!)
          return node!.id
        })

        await comfyPage.vueNodes.waitForNodes(1)

        const header = comfyPage.page.locator(
          `[data-testid="node-header-${nodeId}"]`
        )
        await expect(header).toBeVisible()

        // Verify list format (4.2/10.6 credits for [$0.02, $0.05])
        const badgeContainer = header.locator(
          'span:has(> i[class*="lucide--component"])'
        )
        await expect
          .poll(async () => (await badgeContainer.textContent())?.trim() ?? '')
          .toContain('4.2/10.6')
      }
    )
  }
)
