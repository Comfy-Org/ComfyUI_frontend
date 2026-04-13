import { expect } from '@playwright/test'

import { comfyPageFixture as test, comfyExpect } from '@e2e/fixtures/ComfyPage'
import { SubgraphHelper } from '@e2e/fixtures/helpers/SubgraphHelper'
import { TestIds } from '@e2e/fixtures/selectors'

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
        await comfyPage.nextFrame()

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

  /**
   * Regression test for #10612: promoted widget indicator ring missing on
   * nested subgraph nodes.
   *
   * Uses the 3-level nested fixture (subgraph-nested-promotion):
   *   Root → Sub 0 (node 5) → Sub 1 (node 6) → Sub 2 (node 9)
   *
   * Node 6 (Sub 1) has proxyWidgets promoting widgets from inner nodes,
   * and those promotions are also promoted up to node 5 (Sub 0). When
   * navigating into Sub 0, node 6 should show the promoted ring on its
   * widgets.
   */
  test.describe(
    'Promoted indicator on 3-level nested subgraphs (#10612)',
    { tag: ['@widget', '@vue-nodes'] },
    () => {
      const WORKFLOW = 'subgraphs/subgraph-nested-promotion'
      const PROMOTED_BORDER_CLASS = 'ring-component-node-widget-promoted'

      test('Intermediate SubgraphNode shows promoted ring inside parent subgraph', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow(WORKFLOW)
        await comfyPage.vueNodes.waitForNodes()

        // At root level, node 5 (Sub 0) is the outermost SubgraphNode.
        // Its widgets are not promoted further, so no ring expected.
        const outerNode = comfyPage.vueNodes.getNodeLocator('5')
        await comfyExpect(outerNode).toBeVisible()

        const outerRings = outerNode.locator(`.${PROMOTED_BORDER_CLASS}`)
        await comfyExpect(outerRings).toHaveCount(0)

        // Navigate programmatically — the enter-subgraph button on
        // node 5 is obscured by the canvas z-999 overlay at root level.
        await comfyPage.page.evaluate(() => {
          const node = window.app!.graph!.getNodeById('5')
          if (node?.isSubgraphNode()) {
            window.app!.canvas.setGraph(node.subgraph)
          }
        })
        await comfyPage.nextFrame()
        await comfyPage.vueNodes.waitForNodes()

        // Node 6 (Sub 1) has proxyWidgets promoted up to Sub 0
        // (node 5). Those promoted widgets should carry the ring.
        const intermediateNode = comfyPage.vueNodes.getNodeLocator('6')
        await comfyExpect(intermediateNode).toBeVisible()

        const intermediateRings = intermediateNode.locator(
          `.${PROMOTED_BORDER_CLASS}`
        )
        await comfyExpect(intermediateRings).not.toHaveCount(0, {
          timeout: 5000
        })
      })
    }
  )
})
