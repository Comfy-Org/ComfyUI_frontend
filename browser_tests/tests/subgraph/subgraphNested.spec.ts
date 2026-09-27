import { expect } from '@playwright/test'

import { comfyPageFixture as test, comfyExpect } from '@e2e/fixtures/ComfyPage'
import { SubgraphHelper } from '@e2e/fixtures/helpers/SubgraphHelper'
import { TestIds } from '@e2e/fixtures/selectors'
import { getPromotedWidgets } from '@e2e/fixtures/utils/promotedWidgets'

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
    { tag: ['@widget', '@vue-nodes'] },
    () => {
      const WORKFLOW = 'subgraphs/nested-duplicate-widget-names'
      const OUTER_NODE_ID = '4'
      const INNER_SUBGRAPH_NODE_ID = '3'

      test('Promoted widget values from both inner CLIPTextEncode nodes are distinguishable', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow(WORKFLOW)

        const outerNode = comfyPage.vueNodes.getNodeLocator(OUTER_NODE_ID)
        await comfyExpect(outerNode).toBeVisible()

        const outerWidgets = outerNode.getByTestId(TestIds.widgets.widget)
        await comfyExpect(outerWidgets).toHaveCount(1)

        const exposedTextWidget = outerNode.getByRole('textbox', {
          name: 'text'
        })
        await comfyExpect(exposedTextWidget).toHaveValue('22222222222')

        await comfyPage.vueNodes.enterSubgraph(OUTER_NODE_ID)

        const innerNode = comfyPage.vueNodes.getNodeLocator(
          INNER_SUBGRAPH_NODE_ID
        )
        await comfyExpect(innerNode).toBeVisible()

        const innerTextboxes = innerNode.getByRole('textbox')
        await comfyExpect(innerTextboxes).toHaveCount(2)
        const innerValues = await innerTextboxes.evaluateAll<
          string[],
          HTMLInputElement
        >((boxes) => boxes.map((b) => b.value))
        comfyExpect(innerValues).toContain('11111111111')
        comfyExpect(innerValues).toContain('22222222222')
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
    { tag: ['@widget', '@vue-nodes'] },
    () => {
      const WORKFLOW = 'subgraphs/subgraph-nested-promotion'
      const OUTER_NODE_ID = '5'
      const INNER_SUBGRAPH_NODE_ID = '6'

      test('Nested SubgraphNode promoted widgets render without resolution failures', async ({
        comfyPage
      }) => {
        const { warnings, dispose } = SubgraphHelper.collectConsoleWarnings(
          comfyPage.page,
          ['No link found', 'Failed to resolve legacy -1']
        )

        try {
          await comfyPage.workflow.loadWorkflow(WORKFLOW)

          const outerNode = comfyPage.vueNodes.getNodeLocator(OUTER_NODE_ID)
          await comfyExpect(outerNode).toBeVisible()

          const widgets = outerNode.getByTestId(TestIds.widgets.widget)
          await comfyExpect(
            widgets,
            'asset has 4 promoted widgets on outer subgraph node'
          ).toHaveCount(4)

          expect(warnings).toEqual([])
        } finally {
          dispose()
        }
      })

      // Each promoted input must surface its own source value, so assert the
      // name->value mapping rather than the first textbox in DOM order.
      const EXPECTED_VALUE_BY_INPUT: Record<string, RegExp> = {
        value: /Inner 1/,
        value_1: /Inner 2/,
        value_1_1: /Inner 3/
      }

      test('Promoted widgets from inner SubgraphNode are visible with correct values', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow(WORKFLOW)

        const outerNode = comfyPage.vueNodes.getNodeLocator(OUTER_NODE_ID)
        await comfyExpect(outerNode).toBeVisible()

        const widgets = outerNode.getByTestId(TestIds.widgets.widget)
        await comfyExpect(widgets).toHaveCount(4)

        for (const [inputName, expectedValue] of Object.entries(
          EXPECTED_VALUE_BY_INPUT
        )) {
          const valueWidget = outerNode.getByRole('textbox', {
            name: inputName,
            exact: true
          })
          await comfyExpect(valueWidget).toBeVisible()
          await comfyExpect(valueWidget).toHaveValue(expectedValue)
        }
      })

      test('Promoted widgets from inner SubgraphNode carry correct source identity', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow(WORKFLOW)

        await expect
          .poll(async () => {
            const widgets = await getPromotedWidgets(comfyPage, OUTER_NODE_ID)
            return widgets
              .filter(
                ([sourceNodeId]) => sourceNodeId === INNER_SUBGRAPH_NODE_ID
              )
              .map(([, sourceWidgetName]) => sourceWidgetName)
          })
          .toContain('value')
      })

      test('Serialize and reload preserves nested promoted widget visibility', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow(WORKFLOW)

        const outerNode = comfyPage.vueNodes.getNodeLocator(OUTER_NODE_ID)
        const widgets = outerNode.getByTestId(TestIds.widgets.widget)
        await comfyExpect(
          widgets,
          'asset has 4 promoted widgets on outer subgraph node'
        ).toHaveCount(4)
        const initialCount = await widgets.count()

        await comfyPage.subgraph.serializeAndReload()

        const outerNodeAfter = comfyPage.vueNodes.getNodeLocator(OUTER_NODE_ID)
        const widgetsAfter = outerNodeAfter.getByTestId(TestIds.widgets.widget)
        await comfyExpect(widgetsAfter).toHaveCount(initialCount)

        for (const [inputName, expectedValue] of Object.entries(
          EXPECTED_VALUE_BY_INPUT
        )) {
          const valueWidget = outerNodeAfter.getByRole('textbox', {
            name: inputName,
            exact: true
          })
          await comfyExpect(valueWidget).toBeVisible()
          await comfyExpect(valueWidget).toHaveValue(expectedValue)
        }
      })
    }
  )
})
