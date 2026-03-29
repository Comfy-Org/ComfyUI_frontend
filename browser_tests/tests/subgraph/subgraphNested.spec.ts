import { expect } from '@playwright/test'

import { comfyPageFixture as test, comfyExpect } from '../../fixtures/ComfyPage'
import { SubgraphHelper } from '../../fixtures/helpers/SubgraphHelper'
import { TestIds } from '../../fixtures/selectors'

test.describe('Subgraph Nested Scenarios', { tag: ['@subgraph'] }, () => {
  test.describe('Nested subgraph configure order', () => {
    const WORKFLOW = 'subgraphs/subgraph-nested-duplicate-ids'

    test('Loads without "No link found" or "Failed to resolve legacy -1" console warnings', async ({
      comfyPage
    }) => {
      const { warnings } = SubgraphHelper.collectConsoleWarnings(
        comfyPage.page,
        ['No link found', 'Failed to resolve legacy -1']
      )

      await comfyPage.workflow.loadWorkflow(WORKFLOW)

      expect(warnings).toEqual([])
    })

    test('All three subgraph levels resolve promoted widgets', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(WORKFLOW)
      await comfyPage.nextFrame()

      const results = await comfyPage.page.evaluate(() => {
        const graph = window.app!.canvas.graph!
        const allGraphs = [graph, ...graph.subgraphs.values()]

        return allGraphs.flatMap((g) =>
          g._nodes
            .filter(
              (n) =>
                typeof n.isSubgraphNode === 'function' && n.isSubgraphNode()
            )
            .map((hostNode) => {
              const proxyWidgets = Array.isArray(
                hostNode.properties?.proxyWidgets
              )
                ? hostNode.properties.proxyWidgets
                : []

              const widgetEntries = proxyWidgets
                .filter(
                  (e: unknown): e is [string, string] =>
                    Array.isArray(e) &&
                    e.length >= 2 &&
                    typeof e[0] === 'string' &&
                    typeof e[1] === 'string'
                )
                .map(([interiorNodeId, widgetName]: [string, string]) => {
                  const sg = hostNode.isSubgraphNode()
                    ? hostNode.subgraph
                    : null
                  const interiorNode = sg?.getNodeById(Number(interiorNodeId))
                  return {
                    interiorNodeId,
                    widgetName,
                    resolved:
                      interiorNode !== null && interiorNode !== undefined
                  }
                })

              return {
                hostNodeId: String(hostNode.id),
                widgetEntries
              }
            })
        )
      })

      expect(
        results.length,
        'Should have subgraph host nodes at multiple nesting levels'
      ).toBeGreaterThanOrEqual(2)

      for (const { hostNodeId, widgetEntries } of results) {
        expect(
          widgetEntries.length,
          `Host node ${hostNodeId} should have promoted widgets`
        ).toBeGreaterThan(0)

        for (const { interiorNodeId, widgetName, resolved } of widgetEntries) {
          expect(interiorNodeId).not.toBe('-1')
          expect(Number(interiorNodeId)).toBeGreaterThan(0)
          expect(widgetName).toBeTruthy()
          expect(
            resolved,
            `Widget "${widgetName}" (interior node ${interiorNodeId}) on host ${hostNodeId} should resolve`
          ).toBe(true)
        }
      }
    })

    test('Prompt execution succeeds without 400 error', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(WORKFLOW)
      await comfyPage.nextFrame()

      const responsePromise = comfyPage.page.waitForResponse('**/api/prompt')

      await comfyPage.command.executeCommand('Comfy.QueuePrompt')

      const response = await responsePromise
      expect(response.status()).not.toBe(400)
    })
  })

  /**
   * Regression tests for nested subgraph promotion where multiple interior
   * nodes share the same widget name (e.g. two CLIPTextEncode nodes both
   * with a "text" widget).
   *
   * The inner subgraph (node 3) promotes both ["1","text"] and ["2","text"].
   * The outer subgraph (node 4) promotes through node 3 using identity
   * disambiguation (optional sourceNodeId in the promotion entry).
   *
   * See: https://github.com/Comfy-Org/ComfyUI_frontend/pull/10123#discussion_r2956230977
   */
  test.describe(
    'Nested subgraph duplicate widget names',
    { tag: ['@widget'] },
    () => {
      const WORKFLOW = 'subgraphs/nested-duplicate-widget-names'
      const PROMOTED_BORDER_CLASS = 'ring-component-node-widget-promoted'

      test.beforeEach(async ({ comfyPage }) => {
        await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
      })

      test('Inner subgraph node has both text widgets promoted', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow(WORKFLOW)
        await comfyPage.nextFrame()

        const nonPreview = await comfyPage.page.evaluate(() => {
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

          return (
            (innerSubgraphNode.properties?.proxyWidgets ?? []) as unknown[]
          )
            .filter(
              (entry): entry is [string, string] =>
                Array.isArray(entry) &&
                entry.length >= 2 &&
                typeof entry[0] === 'string' &&
                typeof entry[1] === 'string' &&
                !entry[1].startsWith('$$')
            )
            .map(
              ([nodeId, widgetName]) => [nodeId, widgetName] as [string, string]
            )
        })

        comfyExpect(nonPreview).toEqual([
          ['1', 'text'],
          ['2', 'text']
        ])
      })

      test('Promoted widget values from both inner CLIPTextEncode nodes are distinguishable', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow(WORKFLOW)
        await comfyPage.nextFrame()

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
      })

      test.describe('Promoted border styling in Vue mode', () => {
        test.beforeEach(async ({ comfyPage }) => {
          await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
        })

        test('Intermediate subgraph widgets get promoted border, outermost does not', async ({
          comfyPage
        }) => {
          await comfyPage.workflow.loadWorkflow(WORKFLOW)
          await comfyPage.vueNodes.waitForNodes()

          // Node 4 is the outer SubgraphNode at root level.
          // Its widgets are not promoted further (no parent subgraph),
          // so none of its widget wrappers should carry the promoted ring.
          const outerNode = comfyPage.vueNodes.getNodeLocator('4')
          await comfyExpect(outerNode).toBeVisible()

          const outerPromotedRings = outerNode.locator(
            `.${PROMOTED_BORDER_CLASS}`
          )
          await comfyExpect(outerPromotedRings).toHaveCount(0)

          // Navigate into the outer subgraph (node 4) to reach node 3
          await comfyPage.vueNodes.enterSubgraph('4')
          await comfyPage.nextFrame()
          await comfyPage.vueNodes.waitForNodes()

          // Node 3 is the intermediate SubgraphNode whose "text" widgets
          // are promoted up to the outer subgraph (node 4).
          // Its widget wrappers should carry the promoted border ring.
          const intermediateNode = comfyPage.vueNodes.getNodeLocator('3')
          await comfyExpect(intermediateNode).toBeVisible()

          const intermediatePromotedRings = intermediateNode.locator(
            `.${PROMOTED_BORDER_CLASS}`
          )
          await comfyExpect(intermediatePromotedRings).toHaveCount(1)
        })
      })
    }
  )

  /**
   * Regression test for PR #10532:
   * Packing all nodes inside a subgraph into a nested subgraph was causing
   * the parent subgraph node's promoted widget values to go blank.
   *
   * Root cause: SubgraphNode had two sets of PromotedWidgetView references —
   * node.widgets (rebuilt from the promotion store) vs input._widget (cached
   * at promotion time). After repointing, input._widget still pointed to
   * removed node IDs, causing missing-node failures and blank values on the
   * next checkState cycle.
   */
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

        // 1. Verify initial promoted widget values via Vue node DOM
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

        // 2. Pack all interior nodes into a nested subgraph
        await comfyPage.subgraph.packAllInteriorNodes(HOST_NODE_ID)

        // 6. Re-enable Vue nodes and verify values are preserved
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

      test('proxyWidgets entries resolve to valid interior nodes after packing', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow(WORKFLOW)
        await comfyPage.vueNodes.waitForNodes()

        // Verify the host node is visible
        const nodeLocator = comfyPage.vueNodes.getNodeLocator(HOST_NODE_ID)
        await comfyExpect(nodeLocator).toBeVisible()

        // Pack all interior nodes into a nested subgraph
        await comfyPage.subgraph.packAllInteriorNodes(HOST_NODE_ID)

        // Verify all proxyWidgets entries resolve
        await comfyExpect(async () => {
          const result = await comfyPage.page.evaluate((hostId) => {
            const graph = window.app!.graph!
            const hostNode = graph.getNodeById(hostId)
            if (
              !hostNode ||
              typeof hostNode.isSubgraphNode !== 'function' ||
              !hostNode.isSubgraphNode()
            ) {
              return { error: 'Host node not found or not a subgraph node' }
            }

            const proxyWidgets = hostNode.properties?.proxyWidgets ?? []
            const entries = (proxyWidgets as unknown[])
              .filter(
                (e): e is [string, string] =>
                  Array.isArray(e) &&
                  e.length >= 2 &&
                  typeof e[0] === 'string' &&
                  typeof e[1] === 'string' &&
                  !e[1].startsWith('$$')
              )
              .map(([nodeId, widgetName]) => {
                const interiorNode = hostNode.subgraph.getNodeById(
                  Number(nodeId)
                )
                return {
                  nodeId,
                  widgetName,
                  resolved: interiorNode !== null && interiorNode !== undefined
                }
              })

            return { entries, count: entries.length }
          }, HOST_NODE_ID)

          expect(result).not.toHaveProperty('error')
          const { entries, count } = result as {
            entries: { nodeId: string; widgetName: string; resolved: boolean }[]
            count: number
          }
          expect(count).toBeGreaterThan(0)
          for (const entry of entries) {
            expect(
              entry.resolved,
              `Widget "${entry.widgetName}" (node ${entry.nodeId}) should resolve`
            ).toBe(true)
          }
        }).toPass({ timeout: 5000 })
      })
    }
  )

  /**
   * Regression test for nested subgraph packing leaving stale proxyWidgets
   * on the outer SubgraphNode.
   *
   * When two CLIPTextEncode nodes (ids 6, 7) inside the outer subgraph are
   * packed into a nested subgraph (node 11), the outer SubgraphNode (id 10)
   * must drop the now-stale ["7","text"] and ["6","text"] proxy entries.
   * Only ["3","seed"] (KSampler) should remain.
   *
   * Stale entries render as "Disconnected" placeholder widgets (type "button").
   *
   * See: https://github.com/Comfy-Org/ComfyUI_frontend/pull/10390
   */
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

        // Only the KSampler seed widget should be present — no stale
        // "Disconnected" placeholders from the packed CLIPTextEncode nodes.
        await comfyExpect(widgets).toHaveCount(1)
        await comfyExpect(widgets.first()).toBeVisible()

        // Verify the seed widget is present via its label
        const seedWidget = outerNode.getByLabel('seed', { exact: true })
        await comfyExpect(seedWidget).toBeVisible()
      })
    }
  )
})
