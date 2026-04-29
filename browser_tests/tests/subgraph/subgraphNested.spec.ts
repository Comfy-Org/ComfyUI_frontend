import { expect } from '@playwright/test'

import { comfyPageFixture as test, comfyExpect } from '@e2e/fixtures/ComfyPage'
import { SubgraphHelper } from '@e2e/fixtures/helpers/SubgraphHelper'
import { TestIds } from '@e2e/fixtures/selectors'
import {
  getPromotedWidgetCount,
  getPromotedWidgets
} from '@e2e/helpers/promotedWidgets'

test.describe('Nested Subgraphs', { tag: ['@subgraph'] }, () => {
  test.describe('Nested subgraph configure order', () => {
    const WORKFLOW = 'subgraphs/subgraph-nested-duplicate-ids'

    test('Loads and queues without nested promotion resolution failures', async ({
      comfyPage
    }) => {
      const { warnings, dispose } = SubgraphHelper.collectConsoleWarnings(
        comfyPage.page,
        ['No link found', 'Failed to resolve legacy -1']
      )

      try {
        await comfyPage.workflow.loadWorkflow(WORKFLOW)

        const responsePromise = comfyPage.page.waitForResponse('**/api/prompt')
        await comfyPage.command.executeCommand('Comfy.QueuePrompt')

        const response = await responsePromise
        expect(warnings).toEqual([])
        expect(response.ok()).toBe(true)
      } finally {
        dispose()
      }
    })
  })

  test.describe(
    'Nested subgraph duplicate widget names',
    { tag: ['@widget'] },
    () => {
      const WORKFLOW = 'subgraphs/nested-duplicate-widget-names'

      test.beforeEach(async ({ comfyPage }) => {
        await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
      })

      test('Promoted widget values from both inner CLIPTextEncode nodes are distinguishable', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow(WORKFLOW)

        await comfyExpect(async () => {
          const widgetValues = await comfyPage.page.evaluate(() => {
            const graph = window.app!.canvas.graph!
            const outerNode = graph.getNodeById('4')
            if (
              !outerNode ||
              typeof outerNode.isSubgraphNode !== 'function' ||
              !outerNode.isSubgraphNode()
            ) {
              return []
            }

            const innerSubgraphNode = outerNode.subgraph.getNodeById(3)
            if (!innerSubgraphNode) return []

            return (innerSubgraphNode.widgets ?? []).map((w) => ({
              name: w.name,
              value: w.value
            }))
          })

          const textWidgets = widgetValues.filter((w) =>
            w.name.startsWith('text')
          )
          comfyExpect(textWidgets).toHaveLength(2)

          const values = textWidgets.map((w) => w.value)
          comfyExpect(values).toContain('11111111111')
          comfyExpect(values).toContain('22222222222')
        }).toPass({ timeout: 5_000 })
      })
    }
  )

  test.describe(
    'Nested subgraph pack preserves promoted widget values',
    { tag: ['@widget'] },
    () => {
      const WORKFLOW = 'subgraphs/nested-pack-promoted-values'
      const HOST_NODE_ID = '57'

      test.beforeEach(async ({ comfyPage }) => {
        await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
      })

      test('Promoted widget values persist after packing interior nodes into nested subgraph', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow(WORKFLOW)
        await comfyPage.vueNodes.waitForNodes()

        const nodeLocator = comfyPage.vueNodes.getNodeLocator(HOST_NODE_ID)
        await comfyExpect(nodeLocator).toBeVisible()

        const widthWidget = nodeLocator
          .getByLabel('width', { exact: true })
          .first()
        const heightWidget = nodeLocator
          .getByLabel('height', { exact: true })
          .first()
        const stepsWidget = nodeLocator
          .getByLabel('steps', { exact: true })
          .first()
        const textWidget = nodeLocator.getByRole('textbox', { name: 'prompt' })

        const widthControls =
          comfyPage.vueNodes.getInputNumberControls(widthWidget)
        const heightControls =
          comfyPage.vueNodes.getInputNumberControls(heightWidget)
        const stepsControls =
          comfyPage.vueNodes.getInputNumberControls(stepsWidget)

        await comfyExpect(async () => {
          await comfyExpect(widthControls.input).toHaveValue('1024')
          await comfyExpect(heightControls.input).toHaveValue('1024')
          await comfyExpect(stepsControls.input).toHaveValue('8')
          await comfyExpect(textWidget).toHaveValue(/Latina female/)
        }).toPass({ timeout: 5000 })

        await comfyPage.subgraph.packAllInteriorNodes(HOST_NODE_ID)

        await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
        await comfyPage.vueNodes.waitForNodes()

        const nodeAfter = comfyPage.vueNodes.getNodeLocator(HOST_NODE_ID)
        await comfyExpect(nodeAfter).toBeVisible()

        const widthAfter = nodeAfter
          .getByLabel('width', { exact: true })
          .first()
        const heightAfter = nodeAfter
          .getByLabel('height', { exact: true })
          .first()
        const stepsAfter = nodeAfter
          .getByLabel('steps', { exact: true })
          .first()
        const textAfter = nodeAfter.getByRole('textbox', { name: 'prompt' })

        const widthControlsAfter =
          comfyPage.vueNodes.getInputNumberControls(widthAfter)
        const heightControlsAfter =
          comfyPage.vueNodes.getInputNumberControls(heightAfter)
        const stepsControlsAfter =
          comfyPage.vueNodes.getInputNumberControls(stepsAfter)

        await comfyExpect(async () => {
          await comfyExpect(widthControlsAfter.input).toHaveValue('1024')
          await comfyExpect(heightControlsAfter.input).toHaveValue('1024')
          await comfyExpect(stepsControlsAfter.input).toHaveValue('8')
          await comfyExpect(textAfter).toHaveValue(/Latina female/)
        }).toPass({ timeout: 5000 })
      })
    }
  )

  test.describe(
    'Nested subgraph stale proxyWidgets',
    { tag: ['@widget'] },
    () => {
      const WORKFLOW = 'subgraphs/nested-subgraph-stale-proxy-widgets'

      test.beforeEach(async ({ comfyPage }) => {
        await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
      })

      test('Outer subgraph node has no stale proxyWidgets after nested packing', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow(WORKFLOW)
        await comfyPage.vueNodes.waitForNodes()

        const outerNode = comfyPage.vueNodes.getNodeLocator('10')
        await comfyExpect(outerNode).toBeVisible()

        const widgets = outerNode.getByTestId(TestIds.widgets.widget)

        await comfyExpect(widgets).toHaveCount(1)
        await comfyExpect(widgets.first()).toBeVisible()

        const seedWidget = outerNode.getByLabel('seed', { exact: true })
        await comfyExpect(seedWidget).toBeVisible()
      })
    }
  )

  test.describe(
    'Nested subgraph input target resolution',
    { tag: ['@widget'] },
    () => {
      const WORKFLOW = 'subgraphs/subgraph-nested-promotion'
      const OUTER_NODE_ID = '5'
      const INNER_SUBGRAPH_NODE_ID = '6'

      test.beforeEach(async ({ comfyPage }) => {
        await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
      })

      test('Nested SubgraphNode promoted widgets render without resolution failures', async ({
        comfyPage
      }) => {
        const { warnings, dispose } = SubgraphHelper.collectConsoleWarnings(
          comfyPage.page
        )

        try {
          await comfyPage.workflow.loadWorkflow(WORKFLOW)
          await comfyPage.vueNodes.waitForNodes()

          const outerNode = comfyPage.vueNodes.getNodeLocator(OUTER_NODE_ID)
          await comfyExpect(outerNode).toBeVisible()

          await expect
            .poll(() => getPromotedWidgetCount(comfyPage, OUTER_NODE_ID))
            .toBeGreaterThan(0)

          expect(warnings).toEqual([])
        } finally {
          dispose()
        }
      })

      test('Promoted widgets from inner SubgraphNode are visible with correct values', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow(WORKFLOW)
        await comfyPage.vueNodes.waitForNodes()

        const outerNode = comfyPage.vueNodes.getNodeLocator(OUTER_NODE_ID)
        await comfyExpect(outerNode).toBeVisible()

        const widgets = outerNode.getByTestId(TestIds.widgets.widget)
        await comfyExpect(widgets).toHaveCount(4)

        const valueWidget = outerNode
          .getByRole('textbox', { name: 'value' })
          .first()
        await comfyExpect(valueWidget).toBeVisible()
        await comfyExpect(valueWidget).toHaveValue(/Inner 1/)
      })

      test('Promoted widgets from inner SubgraphNode carry correct source identity', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow(WORKFLOW)
        await comfyPage.vueNodes.waitForNodes()

        await expect
          .poll(() => getPromotedWidgets(comfyPage, OUTER_NODE_ID))
          .toEqual(
            expect.arrayContaining([
              [INNER_SUBGRAPH_NODE_ID, expect.any(String)]
            ])
          )
      })

      test('Serialize and reload preserves nested promoted widget visibility', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow(WORKFLOW)
        await comfyPage.vueNodes.waitForNodes()

        const outerNode = comfyPage.vueNodes.getNodeLocator(OUTER_NODE_ID)
        const widgets = outerNode.getByTestId(TestIds.widgets.widget)
        await comfyExpect(widgets).toHaveCount(4)

        const initialCount = await getPromotedWidgetCount(
          comfyPage,
          OUTER_NODE_ID
        )

        await comfyPage.subgraph.serializeAndReload()
        await comfyPage.vueNodes.waitForNodes()

        const outerNodeAfter = comfyPage.vueNodes.getNodeLocator(OUTER_NODE_ID)
        const widgetsAfter = outerNodeAfter.getByTestId(TestIds.widgets.widget)
        await comfyExpect(widgetsAfter).toHaveCount(initialCount)

        const valueWidget = outerNodeAfter
          .getByRole('textbox', { name: 'value' })
          .first()
        await comfyExpect(valueWidget).toBeVisible()
        await comfyExpect(valueWidget).toHaveValue(/Inner 1/)
      })
    }
  )
})
