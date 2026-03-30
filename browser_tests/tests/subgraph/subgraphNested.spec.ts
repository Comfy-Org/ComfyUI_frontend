import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../../fixtures/ComfyPage'
import { SubgraphHelper } from '../../fixtures/helpers/SubgraphHelper'
import { TestIds } from '../../fixtures/selectors'

const NESTED_DUPLICATE_WIDGET_NAMES_WORKFLOW =
  'subgraphs/nested-duplicate-widget-names'

test.describe('Nested Subgraphs', { tag: ['@subgraph', '@widget'] }, () => {
  test.describe('Nested subgraph configure order', () => {
    const workflow = 'subgraphs/subgraph-nested-duplicate-ids'

    test('Loads and queues without nested promotion resolution failures', async ({
      comfyPage
    }) => {
      const { warnings, dispose } = SubgraphHelper.collectConsoleWarnings(
        comfyPage.page,
        ['No link found', 'Failed to resolve legacy -1']
      )

      try {
        await comfyPage.workflow.loadWorkflow(workflow)
        await comfyPage.nextFrame()

        const responsePromise = comfyPage.page.waitForResponse('**/api/prompt')
        await comfyPage.command.executeCommand('Comfy.QueuePrompt')

        const response = await responsePromise
        expect(warnings).toEqual([])
        expect(response.status()).not.toBe(400)
      } finally {
        dispose()
      }
    })
  })

  test.describe('Nested subgraph duplicate widget names', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
    })

    test('Promoted widget values from both inner CLIPTextEncode nodes are distinguishable', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        NESTED_DUPLICATE_WIDGET_NAMES_WORKFLOW
      )
      await comfyPage.nextFrame()

      const widgetValues = await comfyPage.page.evaluate(() => {
        const graph = window.app!.canvas.graph!
        const outerNode = graph.getNodeById('4')
        if (!outerNode?.isSubgraphNode?.()) return []

        const innerSubgraphNode = outerNode.subgraph.getNodeById(3)
        if (!innerSubgraphNode) return []

        return (innerSubgraphNode.widgets ?? []).map((widget) => ({
          name: widget.name,
          value: widget.value
        }))
      })

      const textWidgets = widgetValues.filter((widget) =>
        widget.name.startsWith('text')
      )
      expect(textWidgets).toHaveLength(2)

      const values = textWidgets.map((widget) => widget.value)
      expect(values).toContain('11111111111')
      expect(values).toContain('22222222222')
    })
  })

  test.describe('Nested subgraph pack preserves promoted widget values', () => {
    const workflow = 'subgraphs/nested-pack-promoted-values'
    const hostNodeId = '57'

    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
    })

    test('Promoted widget values persist after packing interior nodes into nested subgraph', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(workflow)
      await comfyPage.vueNodes.waitForNodes()

      const nodeLocator = comfyPage.vueNodes.getNodeLocator(hostNodeId)
      await expect(nodeLocator).toBeVisible()

      const widthControls = comfyPage.vueNodes.getInputNumberControls(
        nodeLocator.getByLabel('width', { exact: true }).first()
      )
      const heightControls = comfyPage.vueNodes.getInputNumberControls(
        nodeLocator.getByLabel('height', { exact: true }).first()
      )
      const stepsControls = comfyPage.vueNodes.getInputNumberControls(
        nodeLocator.getByLabel('steps', { exact: true }).first()
      )
      const textWidget = nodeLocator.getByRole('textbox', { name: 'prompt' })

      await expect(async () => {
        await expect(widthControls.input).toHaveValue('1024')
        await expect(heightControls.input).toHaveValue('1024')
        await expect(stepsControls.input).toHaveValue('8')
        await expect(textWidget).toHaveValue(/Latina female/)
      }).toPass({ timeout: 5_000 })

      await comfyPage.subgraph.packAllInteriorNodes(hostNodeId)

      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
      await comfyPage.vueNodes.waitForNodes()

      const nodeAfter = comfyPage.vueNodes.getNodeLocator(hostNodeId)
      await expect(nodeAfter).toBeVisible()

      const widthAfter = comfyPage.vueNodes.getInputNumberControls(
        nodeAfter.getByLabel('width', { exact: true }).first()
      )
      const heightAfter = comfyPage.vueNodes.getInputNumberControls(
        nodeAfter.getByLabel('height', { exact: true }).first()
      )
      const stepsAfter = comfyPage.vueNodes.getInputNumberControls(
        nodeAfter.getByLabel('steps', { exact: true }).first()
      )
      const textAfter = nodeAfter.getByRole('textbox', { name: 'prompt' })

      await expect(async () => {
        await expect(widthAfter.input).toHaveValue('1024')
        await expect(heightAfter.input).toHaveValue('1024')
        await expect(stepsAfter.input).toHaveValue('8')
        await expect(textAfter).toHaveValue(/Latina female/)
      }).toPass({ timeout: 5_000 })
    })
  })

  test.describe('Nested subgraph stale proxyWidgets', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
    })

    test('Outer subgraph node has no stale proxyWidgets after nested packing', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/nested-subgraph-stale-proxy-widgets'
      )
      await comfyPage.vueNodes.waitForNodes()

      const outerNode = comfyPage.vueNodes.getNodeLocator('10')
      await expect(outerNode).toBeVisible()

      const widgets = outerNode.getByTestId(TestIds.widgets.widget)
      await expect(widgets).toHaveCount(1)
      await expect(widgets.first()).toBeVisible()

      const seedWidget = outerNode.getByLabel('seed', { exact: true })
      await expect(seedWidget).toBeVisible()
    })
  })
})
