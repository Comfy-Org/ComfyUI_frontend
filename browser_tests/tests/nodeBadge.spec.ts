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
          nodeData?: { price_badge?: unknown }
        }
        if (!registered.nodeData) throw new Error(`No nodeData for ${type}`)
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
