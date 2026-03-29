import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'
import { SubgraphHelper } from '../fixtures/helpers/SubgraphHelper'

test.describe('Nested subgraph configure order', { tag: ['@subgraph'] }, () => {
  const WORKFLOW = 'subgraphs/subgraph-nested-duplicate-ids'

  test('Loads without "No link found" or "Failed to resolve legacy -1" console warnings', async ({
    comfyPage
  }) => {
    const { warnings, dispose } = SubgraphHelper.collectConsoleWarnings(
      comfyPage.page,
      ['No link found', 'Failed to resolve legacy -1']
    )

    try {
      await comfyPage.workflow.loadWorkflow(WORKFLOW)

      expect(warnings).toEqual([])
    } finally {
      dispose()
    }
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
            (n) => typeof n.isSubgraphNode === 'function' && n.isSubgraphNode()
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
                const sg = hostNode.isSubgraphNode() ? hostNode.subgraph : null
                const interiorNode = sg?.getNodeById(Number(interiorNodeId))
                return {
                  interiorNodeId,
                  widgetName,
                  resolved: interiorNode !== null && interiorNode !== undefined
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

  test('Prompt execution succeeds without 400 error', async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow(WORKFLOW)
    await comfyPage.nextFrame()

    const responsePromise = comfyPage.page.waitForResponse('**/api/prompt')

    await comfyPage.command.executeCommand('Comfy.QueuePrompt')

    const response = await responsePromise
    expect(response.status()).not.toBe(400)
  })
})
