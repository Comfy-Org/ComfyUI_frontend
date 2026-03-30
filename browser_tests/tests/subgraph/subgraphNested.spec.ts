import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../../fixtures/ComfyPage'
import { SubgraphHelper } from '../../fixtures/helpers/SubgraphHelper'
import { TestIds } from '../../fixtures/selectors'

const NESTED_DUPLICATE_WIDGET_NAMES_WORKFLOW =
  'subgraphs/nested-duplicate-widget-names'
const PROMOTED_BORDER_CLASS = 'ring-component-node-widget-promoted'

test.describe('Nested Subgraphs', { tag: ['@subgraph', '@widget'] }, () => {
  test.describe('Nested subgraph configure order', () => {
    const workflow = 'subgraphs/subgraph-nested-duplicate-ids'

    test('Loads without "No link found" or "Failed to resolve legacy -1" console warnings', async ({
      comfyPage
    }) => {
      const { warnings } = SubgraphHelper.collectConsoleWarnings(
        comfyPage.page,
        ['No link found', 'Failed to resolve legacy -1']
      )

      await comfyPage.workflow.loadWorkflow(workflow)

      expect(warnings).toEqual([])
    })

    test('All three subgraph levels resolve promoted widgets', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(workflow)
      await comfyPage.nextFrame()

      const results = await comfyPage.page.evaluate(() => {
        const graph = window.app!.canvas.graph!
        const allGraphs = [graph, ...graph.subgraphs.values()]

        return allGraphs.flatMap((g) =>
          g._nodes
            .filter(
              (node) =>
                typeof node.isSubgraphNode === 'function' &&
                node.isSubgraphNode()
            )
            .map((hostNode) => {
              const proxyWidgets = Array.isArray(
                hostNode.properties?.proxyWidgets
              )
                ? hostNode.properties.proxyWidgets
                : []

              const widgetEntries = proxyWidgets
                .filter(
                  (entry: unknown): entry is [string, string] =>
                    Array.isArray(entry) &&
                    entry.length >= 2 &&
                    typeof entry[0] === 'string' &&
                    typeof entry[1] === 'string'
                )
                .map(([interiorNodeId, widgetName]: [string, string]) => {
                  const subgraph = hostNode.isSubgraphNode()
                    ? hostNode.subgraph
                    : null
                  const interiorNode = subgraph?.getNodeById(
                    Number(interiorNodeId)
                  )
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

      expect(results.length).toBeGreaterThanOrEqual(2)

      for (const { hostNodeId, widgetEntries } of results) {
        expect(widgetEntries.length).toBeGreaterThan(0)

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
      await comfyPage.workflow.loadWorkflow(workflow)
      await comfyPage.nextFrame()

      const responsePromise = comfyPage.page.waitForResponse('**/api/prompt')
      await comfyPage.command.executeCommand('Comfy.QueuePrompt')

      const response = await responsePromise
      expect(response.status()).not.toBe(400)
    })
  })

  test.describe('Nested subgraph duplicate widget names', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
    })

    test('Inner subgraph node has both text widgets promoted', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        NESTED_DUPLICATE_WIDGET_NAMES_WORKFLOW
      )
      await comfyPage.nextFrame()

      const nonPreview = await comfyPage.page.evaluate(() => {
        const graph = window.app!.canvas.graph!
        const outerNode = graph.getNodeById('4')
        if (!outerNode?.isSubgraphNode?.()) return []

        const innerSubgraphNode = outerNode.subgraph.getNodeById(3)
        if (!innerSubgraphNode) return []

        return ((innerSubgraphNode.properties?.proxyWidgets ?? []) as unknown[])
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

      expect(nonPreview).toEqual([
        ['1', 'text'],
        ['2', 'text']
      ])
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

    test.describe('Promoted border styling in Vue mode', () => {
      test.beforeEach(async ({ comfyPage }) => {
        await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
      })

      test('Intermediate subgraph widgets get promoted border, outermost does not', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow(
          NESTED_DUPLICATE_WIDGET_NAMES_WORKFLOW
        )
        await comfyPage.vueNodes.waitForNodes()

        const outerNode = comfyPage.vueNodes.getNodeLocator('4')
        await expect(outerNode).toBeVisible()
        await expect(
          outerNode.locator(`.${PROMOTED_BORDER_CLASS}`)
        ).toHaveCount(0)

        await comfyPage.vueNodes.enterSubgraph('4')
        await comfyPage.nextFrame()
        await comfyPage.vueNodes.waitForNodes()

        const intermediateNode = comfyPage.vueNodes.getNodeLocator('3')
        await expect(intermediateNode).toBeVisible()
        await expect(
          intermediateNode.locator(`.${PROMOTED_BORDER_CLASS}`)
        ).toHaveCount(1)
      })
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

    test('proxyWidgets entries resolve to valid interior nodes after packing', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(workflow)
      await comfyPage.vueNodes.waitForNodes()

      const nodeLocator = comfyPage.vueNodes.getNodeLocator(hostNodeId)
      await expect(nodeLocator).toBeVisible()

      await comfyPage.subgraph.packAllInteriorNodes(hostNodeId)

      await expect(async () => {
        const result = await comfyPage.page.evaluate((id) => {
          const graph = window.app!.graph!
          const hostNode = graph.getNodeById(id)
          if (!hostNode?.isSubgraphNode?.()) {
            return { error: 'Host node not found or not a subgraph node' }
          }

          const proxyWidgets = hostNode.properties?.proxyWidgets ?? []
          const entries = (proxyWidgets as unknown[])
            .filter(
              (entry): entry is [string, string] =>
                Array.isArray(entry) &&
                entry.length >= 2 &&
                typeof entry[0] === 'string' &&
                typeof entry[1] === 'string' &&
                !entry[1].startsWith('$$')
            )
            .map(([nodeId, widgetName]) => {
              const interiorNode = hostNode.subgraph.getNodeById(Number(nodeId))
              return {
                nodeId,
                widgetName,
                resolved: interiorNode !== null && interiorNode !== undefined
              }
            })

          return { entries, count: entries.length }
        }, hostNodeId)

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
