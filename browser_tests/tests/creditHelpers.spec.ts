import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { LGraphEventMode } from '@/lib/litegraph/src/types/globalEnums'
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

    for (const { compact, hideStatus } of [
      { compact: false, hideStatus: false },
      { compact: false, hideStatus: true },
      { compact: true, hideStatus: false },
      { compact: true, hideStatus: true }
    ] as const) {
      testWithMockedObjectInfo(
        `keeps collapsed badges independent with compact=${compact} and hideStatus=${hideStatus}`,
        async ({ comfyPage }) => {
          await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
          await comfyPage.settings.setSetting(
            'Comfy.NodeBadge.ShowApiPricing',
            true
          )
          await comfyPage.settings.setSetting(
            'Comfy.VueNodes.CompactCollapsedNodes',
            compact
          )
          await comfyPage.settings.setSetting(
            'Comfy.VueNodes.HideStatusBadges',
            hideStatus
          )
          await comfyPage.nodeOps.clearGraph()

          const nodeId = await comfyPage.page.evaluate((mode) => {
            const node = window.LiteGraph!.createNode('TestCreditApiNodeUsd')!
            node.mode = mode
            node.title = 'API'
            node.setPos(100, 100)
            node.setSize([400, node.size[1]])
            window.app!.graph.add(node)
            return node.id
          }, LGraphEventMode.BYPASS)

          await comfyPage.vueNodes.waitForNodes(1)
          const vueNode = comfyPage.vueNodes.getNodeLocator(String(nodeId))
          const header = vueNode.locator(
            `[data-testid="node-header-${nodeId}"]`
          )
          const collapseButton = vueNode.getByTestId('node-collapse-button')
          const pricing = header.locator(
            'span:has(> i[class*="lucide--component"])'
          )
          const status = header.getByText('Bypassed', { exact: true })

          await expect(pricing).toContainText('10.6')
          await expect(status).toHaveCount(hideStatus ? 0 : 1)
          const expandedBox = await vueNode.boundingBox()
          if (!expandedBox) throw new Error('Expanded node has no bounds')

          await collapseButton.press('Enter')
          await expect(vueNode).toHaveAttribute('data-collapsed', 'true')
          await expect(pricing).toHaveCount(compact ? 0 : 1)
          await expect(status).toHaveCount(compact || hideStatus ? 0 : 1)

          if (compact) {
            await expect
              .poll(async () => (await vueNode.boundingBox())?.width)
              .toBeLessThan(expandedBox.width)
          } else {
            await expect
              .poll(() =>
                vueNode.evaluate((element) =>
                  Number.parseFloat(getComputedStyle(element).width)
                )
              )
              .toBeGreaterThanOrEqual(225)
          }

          await collapseButton.press('Enter')
          await expect(pricing).toHaveCount(1)
          await expect(status).toHaveCount(hideStatus ? 0 : 1)
          await expect
            .poll(async () => (await vueNode.boundingBox())?.width)
            .toBeCloseTo(expandedBox.width, 0)
        }
      )
    }

    testWithMockedObjectInfo(
      'updates compact and status settings while a node is mounted',
      async ({ comfyPage }) => {
        await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
        await comfyPage.settings.setSetting(
          'Comfy.NodeBadge.ShowApiPricing',
          true
        )
        await comfyPage.settings.setSetting(
          'Comfy.VueNodes.CompactCollapsedNodes',
          false
        )
        await comfyPage.settings.setSetting(
          'Comfy.VueNodes.HideStatusBadges',
          false
        )
        await comfyPage.nodeOps.clearGraph()

        const nodeId = await comfyPage.page.evaluate((mode) => {
          const node = window.LiteGraph!.createNode('TestCreditApiNodeUsd')!
          node.mode = mode
          node.title = 'API'
          node.setPos(100, 100)
          node.setSize([400, node.size[1]])
          window.app!.graph.add(node)
          return node.id
        }, LGraphEventMode.NEVER)

        await comfyPage.vueNodes.waitForNodes(1)
        const nodeFixture = await comfyPage.vueNodes.getFixtureByTitle('API')
        const vueNode = comfyPage.vueNodes.getNodeLocator(String(nodeId))
        const header = vueNode.locator(`[data-testid="node-header-${nodeId}"]`)
        const pricing = header.locator(
          'span:has(> i[class*="lucide--component"])'
        )
        const status = header.getByText('Muted', { exact: true })

        await expect(pricing).toContainText('10.6')
        await nodeFixture.collapseButton.press('Enter')
        await expect(pricing).toHaveCount(1)
        await expect(status).toHaveCount(1)
        const normalCollapsedBox = await vueNode.boundingBox()
        if (!normalCollapsedBox) throw new Error('Collapsed node has no bounds')

        await comfyPage.settings.setSetting(
          'Comfy.VueNodes.CompactCollapsedNodes',
          true
        )
        await expect(pricing).toHaveCount(0)
        await expect(status).toHaveCount(0)
        await expect
          .poll(async () => (await vueNode.boundingBox())?.width)
          .toBeLessThan(normalCollapsedBox.width)

        await comfyPage.settings.setSetting(
          'Comfy.VueNodes.CompactCollapsedNodes',
          false
        )
        await expect(pricing).toHaveCount(1)
        await expect(status).toHaveCount(1)

        await comfyPage.settings.setSetting(
          'Comfy.VueNodes.HideStatusBadges',
          true
        )
        await expect(status).toHaveCount(0)
        await expect(pricing).toHaveCount(1)

        await nodeFixture.collapseButton.press('Enter')
        await expect(status).toHaveCount(0)
        await expect(pricing).toHaveCount(1)

        await comfyPage.settings.setSetting(
          'Comfy.VueNodes.HideStatusBadges',
          false
        )
        await expect(status).toHaveCount(1)

        await comfyPage.settings.setSetting(
          'Comfy.VueNodes.CompactCollapsedNodes',
          true
        )
        await nodeFixture.setTitle(
          'A deliberately long API node title that must remain width capped'
        )
        const expandedBox = await vueNode.boundingBox()
        if (!expandedBox) throw new Error('Expanded node has no bounds')

        await nodeFixture.collapseButton.press('Enter')
        await expect
          .poll(async () => (await vueNode.boundingBox())?.width)
          .toBeLessThanOrEqual(expandedBox.width)
      }
    )
  }
)
