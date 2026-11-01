import { expect } from '@playwright/test'

import type { ComfyApp } from '@/scripts/app'
import { NodeBadgeMode } from '@/types/nodeSource'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { expectRegionScreenshot } from '@e2e/fixtures/utils/screenshotRegion'

test.use({ initialSettings: { 'Comfy.UseNewMenu': 'Disabled' } })

const DEPRECATED_NODE_TYPE = 'ImageBatch'
const API_NODE_TYPE = 'FluxProUltraImageNode'
const BADGE_OVERHANG_PADDING = 40

async function expectAllNodesScreenshot(comfyPage: ComfyPage, name: string) {
  await expectRegionScreenshot(
    comfyPage.page,
    [
      ...(await comfyPage.nodeOps.getAllNodeRefs()),
      ...(await comfyPage.vueNodes.nodes.all())
    ],
    name,
    { padding: BADGE_OVERHANG_PADDING }
  )
}

test.describe('Node Badge', { tag: ['@screenshot', '@smoke', '@node'] }, () => {
  test('Can add badge', async ({ comfyPage }) => {
    await comfyPage.page.evaluate(() => {
      const LGraphBadge = window.LGraphBadge!
      const app = window.app as ComfyApp
      const graph = app.graph
      const nodes = graph.nodes

      for (const node of nodes) {
        node.badges = [new LGraphBadge({ text: 'Test Badge' })]
      }

      graph.setDirtyCanvas(true, true)
    })

    await expectAllNodesScreenshot(comfyPage, 'node-badge.png')
  })

  test('Can add multiple badges', async ({ comfyPage }) => {
    await comfyPage.page.evaluate(() => {
      const LGraphBadge = window.LGraphBadge!
      const app = window.app as ComfyApp
      const graph = app.graph
      const nodes = graph.nodes

      for (const node of nodes) {
        node.badges = [
          new LGraphBadge({ text: 'Test Badge 1' }),
          new LGraphBadge({ text: 'Test Badge 2' })
        ]
      }

      graph.setDirtyCanvas(true, true)
    })

    await expectAllNodesScreenshot(comfyPage, 'node-badge-multiple.png')
  })
})

test.describe('Floating node badges', { tag: ['@vue-nodes', '@node'] }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.nodeOps.clearGraph()
  })

  test.describe('Callback badges', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.nodeOps.addNode(DEPRECATED_NODE_TYPE, undefined, {
        x: 400,
        y: 320
      })
      await comfyPage.page.evaluate(() => {
        const LGraphBadge = window.LGraphBadge!
        window.app!.registerExtension({
          name: 'Test.FloatingBadgeClicks',
          nodeCreated(node) {
            node.badges = [
              new LGraphBadge({ text: 'Passive' }),
              new LGraphBadge({
                text: 'Click badge',
                onClick: () => {
                  node.title = 'Badge clicked'
                }
              })
            ]
          }
        })
      })
      await comfyPage.nodeOps.addNode(DEPRECATED_NODE_TYPE, undefined, {
        x: 400,
        y: 400
      })
    })

    test('lets passive badges pass clicks through while callback badges remain clickable', async ({
      comfyPage
    }) => {
      const [underneath, owner] =
        await comfyPage.nodeOps.getNodeRefsByType(DEPRECATED_NODE_TYPE)
      const node = comfyPage.vueNodes.getNodeLocator(String(owner.id))
      const passive = node.getByText('Passive', { exact: true })
      await expect(passive).toBeVisible()
      const point = await passive.evaluate((element) => {
        const box = element.getBoundingClientRect()
        return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
      })

      await test.step('Click through the passive badge', async () => {
        await comfyPage.page.mouse.click(point.x, point.y)
        await expect
          .poll(() => comfyPage.nodeOps.getSelectedNodeIds())
          .toEqual([underneath.id])
      })

      await test.step('Activate the callback badge in editable mode', async () => {
        await comfyPage.vueNodes.selectNode(String(owner.id))
        await node.getByText('Click badge', { exact: true }).click()
        await expect(node.getByTestId('node-title')).toHaveText('Badge clicked')
      })
    })
  })

  test.describe('Wide badges', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.nodeOps.addNode(DEPRECATED_NODE_TYPE, undefined, {
        x: 400,
        y: 300
      })
      await comfyPage.page.evaluate(() => {
        const LGraphBadge = window.LGraphBadge!
        window.app!.registerExtension({
          name: 'Test.FloatingBadgeGeometry',
          nodeCreated(node) {
            node.badges = [
              new LGraphBadge({
                text: 'A wide extension badge that extends beyond the node width'
              })
            ]
          }
        })
      })
      await comfyPage.nodeOps.addNode(DEPRECATED_NODE_TYPE, undefined, {
        x: 400,
        y: 500
      })
    })

    test('keeps wide badges outside expanded and collapsed node bounds', async ({
      comfyPage
    }) => {
      const [baselineRef, ref] =
        await comfyPage.nodeOps.getNodeRefsByType(DEPRECATED_NODE_TYPE)
      const baseline = comfyPage.vueNodes.getNodeLocator(String(baselineRef.id))
      const node = comfyPage.vueNodes.getNodeLocator(String(ref.id))
      await expect(baseline).toBeVisible()
      await expect(node).toBeVisible()
      const badges = node.getByTestId('node-badges')
      await expect(badges).toBeVisible()
      await comfyPage.vueNodes.selectNode(String(ref.id))
      const outline = node.getByTestId('node-state-outline-overlay')
      await expect(outline).toBeVisible()
      await expect(async () => {
        const baselineBox = await baseline.boundingBox()
        const nodeBox = await node.boundingBox()
        const badgeBox = await badges.boundingBox()
        const outlineBox = await outline.boundingBox()
        if (!baselineBox || !nodeBox || !badgeBox || !outlineBox)
          throw new Error('Badge layout is unavailable')
        expect(nodeBox.width).toBeCloseTo(baselineBox.width, 0)
        expect(badgeBox.width).toBeGreaterThan(nodeBox.width)
        expect(badgeBox.x + badgeBox.width).toBeCloseTo(
          nodeBox.x + nodeBox.width,
          0
        )
        expect(outlineBox.y - (badgeBox.y + badgeBox.height)).toBeCloseTo(4, 0)
      }).toPass({ timeout: 5000 })

      await baselineRef.toggleCollapse()
      await expect(baseline).toHaveAttribute('data-collapsed', 'true')
      await ref.toggleCollapse()
      await expect(node).toHaveAttribute('data-collapsed', 'true')
      await expect(badges).toBeVisible()
      await expect(async () => {
        const baselineBox = await baseline.boundingBox()
        const collapsedBox = await node.boundingBox()
        const collapsedBadgeBox = await badges.boundingBox()
        const outlineBox = await outline.boundingBox()
        if (!baselineBox || !collapsedBox || !collapsedBadgeBox || !outlineBox)
          throw new Error('Collapsed badge layout is unavailable')
        expect(collapsedBox.width).toBeCloseTo(baselineBox.width, 0)
        expect(collapsedBadgeBox.x + collapsedBadgeBox.width).toBeCloseTo(
          collapsedBox.x + collapsedBox.width,
          0
        )
        expect(
          outlineBox.y - (collapsedBadgeBox.y + collapsedBadgeBox.height)
        ).toBeCloseTo(4, 0)
      }).toPass({ timeout: 5000 })
    })
  })
})

test.describe(
  'Node source badge',
  { tag: ['@screenshot', '@smoke', '@node'] },
  () => {
    Object.values(NodeBadgeMode).forEach(async (mode) => {
      test(`Shows node badges (${mode})`, async ({ comfyPage }) => {
        await comfyPage.workflow.loadWorkflow('nodes/execution_error')
        await comfyPage.settings.setSetting(
          'Comfy.NodeBadge.NodeSourceBadgeMode',
          mode
        )
        await comfyPage.settings.setSetting(
          'Comfy.NodeBadge.NodeIdBadgeMode',
          mode
        )
        await expect
          .poll(
            () =>
              comfyPage.settings.getSetting('Comfy.NodeBadge.NodeIdBadgeMode'),
            { message: 'NodeIdBadgeMode setting should be applied' }
          )
          .toBe(mode)
        await expectAllNodesScreenshot(comfyPage, `node-badge-${mode}.png`)
      })
    })
  }
)

test.describe(
  'Node badge color',
  { tag: ['@screenshot', '@smoke', '@node'] },
  () => {
    test('Can show node badge with light color palette', async ({
      comfyPage
    }) => {
      await comfyPage.settings.setSetting(
        'Comfy.NodeBadge.NodeIdBadgeMode',
        NodeBadgeMode.ShowAll
      )
      await comfyPage.settings.setSetting('Comfy.ColorPalette', 'light')
      await expect
        .poll(() => comfyPage.settings.getSetting('Comfy.ColorPalette'), {
          message: 'ColorPalette setting should be applied'
        })
        .toBe('light')
      await comfyPage.canvasOps.clickEmptySpace()
      await expectAllNodesScreenshot(
        comfyPage,
        'node-badge-light-color-palette.png'
      )
    })
  }
)

for (const vueEnabled of [false, true] as const) {
  const renderer = vueEnabled ? 'vue' : 'classic'
  const tag = vueEnabled
    ? ['@vue-nodes', '@screenshot', '@node']
    : ['@screenshot', '@node']

  test.describe(`Node lifecycle badge (${renderer})`, { tag }, () => {
    for (const mode of [NodeBadgeMode.ShowAll, NodeBadgeMode.None] as const) {
      test(`renders deprecated node with mode=${mode}`, async ({
        comfyPage
      }) => {
        await comfyPage.settings.setSetting(
          'Comfy.NodeBadge.NodeLifeCycleBadgeMode',
          mode
        )
        await comfyPage.nodeOps.clearGraph()
        await comfyPage.nodeOps.addNode(DEPRECATED_NODE_TYPE, undefined, {
          x: 100,
          y: 100
        })
        await expectAllNodesScreenshot(
          comfyPage,
          `node-lifecycle-${mode}-${renderer}.png`
        )
      })
    }
  })

  test.describe(`API pricing badge (${renderer})`, { tag }, () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.page.evaluate((type) => {
        const registered = window.LiteGraph!.registered_node_types[type] as {
          nodeData?: {
            price_badge?: unknown
            input?: {
              required?: Record<string, unknown>
              optional?: Record<string, unknown>
            }
            inputs?: Array<{ name?: string }>
          }
        }
        if (!registered.nodeData) throw new Error(`No nodeData for ${type}`)
        delete registered.nodeData.input?.required?.raw
        delete registered.nodeData.input?.optional?.raw
        registered.nodeData.inputs = registered.nodeData.inputs?.filter(
          ({ name }) => name !== 'raw'
        )
        registered.nodeData.price_badge = {
          engine: 'jsonata',
          expr: "{'type': 'text', 'text': '99.9 credits/Run'}",
          depends_on: { widgets: [], inputs: [], input_groups: [] }
        }
      }, API_NODE_TYPE)
    })

    for (const enabled of [true, false] as const) {
      test(`renders api node with showApiPricing=${enabled}`, async ({
        comfyPage
      }) => {
        await comfyPage.settings.setSetting(
          'Comfy.NodeBadge.ShowApiPricing',
          enabled
        )
        await comfyPage.nodeOps.clearGraph()
        await comfyPage.nodeOps.addNode(API_NODE_TYPE, undefined, {
          x: 100,
          y: 100
        })
        await expectAllNodesScreenshot(
          comfyPage,
          `api-pricing-${enabled ? 'on' : 'off'}-${renderer}.png`
        )
      })
    }
  })
}
