import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { fitToViewInstant } from '@e2e/fixtures/utils/fitToView'

test.describe(
  'Vue node size preservation',
  { tag: ['@node', '@vue-nodes'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('nodes/single_ksampler')
      await fitToViewInstant(comfyPage)
    })

    test.afterEach(async ({ comfyPage }) => {
      await comfyPage.canvasOps.resetView()
    })

    test('keeps compact expanded size across collapse and expand', async ({
      comfyPage
    }) => {
      const node = await comfyPage.vueNodes.getFixtureByTitle('KSampler')
      const expandedSize = await comfyPage.page.evaluate(
        ({ nodeId, width }) => {
          const graphNode = window.app!.canvas.graph!._nodes.find(
            (candidate) => String(candidate.id) === nodeId
          )
          if (!graphNode) throw new Error(`Node ${nodeId} not found`)
          graphNode.setSize([width, graphNode.size[1]])
          return [graphNode.size[0], graphNode.size[1]] as const
        },
        { nodeId: '3', width: 160 }
      )
      await comfyPage.nextFrame()

      await expect
        .poll(() =>
          node.root.evaluate((element) =>
            parseFloat(getComputedStyle(element).width)
          )
        )
        .toBeCloseTo(160, 0)

      await node.toggleCollapse()
      await comfyPage.nextFrame()
      await expect(node.root).toHaveAttribute('data-collapsed', 'true')
      await expect
        .poll(() =>
          node.root.evaluate((element) =>
            parseFloat(getComputedStyle(element).width)
          )
        )
        .toBeLessThanOrEqual(160)

      const collapsedState = await comfyPage.page.evaluate((nodeId) => {
        const graph = window.app!.canvas.graph!
        const graphNode = graph._nodes.find(
          (candidate) => String(candidate.id) === nodeId
        )
        if (!graphNode) throw new Error(`Node ${nodeId} not found`)
        const serialised = graph
          .serialize()
          .nodes.find((candidate) => String(candidate.id) === nodeId)
        return {
          modelSize: [graphNode.size[0], graphNode.size[1]],
          serialisedSize: serialised?.size
        }
      }, '3')

      expect(collapsedState.modelSize).toEqual(expandedSize)
      expect(collapsedState.serialisedSize).toEqual(expandedSize)

      await node.toggleCollapse()
      await comfyPage.nextFrame()
      await expect(node.root).not.toHaveAttribute('data-collapsed', 'true')
      await expect
        .poll(() =>
          node.root.evaluate((element) =>
            parseFloat(getComputedStyle(element).width)
          )
        )
        .toBeCloseTo(160, 0)
    })
  }
)
