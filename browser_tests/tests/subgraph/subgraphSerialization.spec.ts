import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { getPromotedWidgets } from '@e2e/helpers/promotedWidgets'

const DUPLICATE_IDS_WORKFLOW = 'subgraphs/subgraph-nested-duplicate-ids'
const LEGACY_PREFIXED_WORKFLOW =
  'subgraphs/nested-subgraph-legacy-prefixed-proxy-widgets'

test.describe('Subgraph Serialization', { tag: ['@subgraph'] }, () => {
  const getPromotedHostWidgetValues = async (
    comfyPage: ComfyPage,
    nodeIds: string[]
  ) => {
    return comfyPage.page.evaluate((ids) => {
      const graph = window.app!.canvas.graph!

      return ids.map((id) => {
        const node = graph.getNodeById(id)
        if (
          !node ||
          typeof node.isSubgraphNode !== 'function' ||
          !node.isSubgraphNode()
        ) {
          return { id, values: [] as unknown[] }
        }

        return {
          id,
          values: (node.widgets ?? []).map((widget) => widget.value)
        }
      })
    }, nodeIds)
  }

  test('Promoted widget remains usable after serialize and reload', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow(
      'subgraphs/subgraph-with-promoted-text-widget'
    )
    await comfyPage.nextFrame()

    const beforeReload = comfyPage.page.locator('.comfy-multiline-input')
    await expect(beforeReload).toHaveCount(1)
    await expect(beforeReload).toBeVisible()

    await comfyPage.subgraph.serializeAndReload()

    const afterReload = comfyPage.page.locator('.comfy-multiline-input')
    await expect(afterReload).toHaveCount(1)
    await expect(afterReload).toBeVisible()
  })

  test('Compressed target_slot workflow boots into a usable promoted widget state', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow(
      'subgraphs/subgraph-compressed-target-slot'
    )
    await comfyPage.nextFrame()

    await expect
      .poll(async () => {
        const widgets = await getPromotedWidgets(comfyPage, '2')
        return widgets.some(([, widgetName]) => widgetName === 'batch_size')
      })
      .toBe(true)
  })

  test('Duplicate ID remap workflow remains navigable after a full reload boot path', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow(DUPLICATE_IDS_WORKFLOW)
    await comfyPage.nextFrame()

    await comfyPage.page.reload()
    await comfyPage.page.waitForFunction(() => !!window.app)
    await comfyPage.workflow.loadWorkflow(DUPLICATE_IDS_WORKFLOW)
    await comfyPage.nextFrame()

    const subgraphNode = await comfyPage.nodeOps.getNodeRefById('5')
    await subgraphNode.navigateIntoSubgraph()

    await expect.poll(() => comfyPage.subgraph.isInSubgraph()).toBe(true)

    await comfyPage.keyboard.press('Escape')

    await expect.poll(() => comfyPage.subgraph.isInSubgraph()).toBe(false)
  })

  test.describe('Legacy prefixed proxyWidget normalization', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
    })

    test('Legacy-prefixed promoted widget renders with the normalized label after load', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(LEGACY_PREFIXED_WORKFLOW)
      await comfyPage.vueNodes.waitForNodes()

      const outerNode = comfyPage.vueNodes.getNodeLocator('5')
      await expect(outerNode).toBeVisible()

      const textarea = outerNode
        .getByRole('textbox', { name: 'string_a' })
        .first()
      await expect(textarea).toBeVisible()
      await expect(textarea).toBeDisabled()
    })

    test('Multiple instances of the same subgraph keep distinct promoted widget values after load and reload', async ({
      comfyPage
    }) => {
      const workflowName =
        'subgraphs/subgraph-multi-instance-promoted-text-values'
      const hostNodeIds = ['11', '12', '13']
      const expectedValues = ['Alpha\n', 'Beta\n', 'Gamma\n']

      await comfyPage.workflow.loadWorkflow(workflowName)
      await comfyPage.nextFrame()

      const initialValues = await getPromotedHostWidgetValues(
        comfyPage,
        hostNodeIds
      )
      expect(initialValues.map(({ values }) => values[0])).toEqual(
        expectedValues
      )

      await comfyPage.subgraph.serializeAndReload()

      const reloadedValues = await getPromotedHostWidgetValues(
        comfyPage,
        hostNodeIds
      )
      expect(reloadedValues.map(({ values }) => values[0])).toEqual(
        expectedValues
      )
    })
  })
})
