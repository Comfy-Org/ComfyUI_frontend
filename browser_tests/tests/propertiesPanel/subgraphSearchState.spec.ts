import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { PropertiesPanelHelper } from '@e2e/tests/propertiesPanel/PropertiesPanelHelper'

async function createTwoSubgraphs(comfyPage: ComfyPage) {
  await comfyPage.workflow.loadWorkflow('default')

  const ksampler = await comfyPage.nodeOps.getNodeRefById('3')
  await ksampler.click('title')
  const subgraphA = await ksampler.convertToSubgraph()
  await comfyPage.nextFrame()

  const clipTextEncode = await comfyPage.nodeOps.getNodeRefById('6')
  await clipTextEncode.click('title')
  const subgraphB = await clipTextEncode.convertToSubgraph()
  await comfyPage.nextFrame()

  return { subgraphA, subgraphB }
}

async function selectNodeById(comfyPage: ComfyPage, nodeId: string) {
  const nodeRef = await comfyPage.nodeOps.getNodeRefById(nodeId)
  await nodeRef.click('title')
  await comfyPage.nextFrame()
}

test.describe(
  'Properties panel - Search state scoping',
  { tag: ['@subgraph'] },
  () => {
    let panel: PropertiesPanelHelper

    test.beforeEach(async ({ comfyPage }) => {
      panel = new PropertiesPanelHelper(comfyPage.page)
      await comfyPage.actionbar.propertiesButton.click()
      await expect(panel.root).toBeVisible()
    })

    test('search resets when selecting a different subgraph node', async ({
      comfyPage
    }) => {
      const { subgraphA, subgraphB } = await createTwoSubgraphs(comfyPage)

      await subgraphA.click('title')
      await comfyPage.nextFrame()
      await panel.searchWidgets('seed')
      await expect(panel.searchBox).toHaveValue('seed')

      await subgraphB.click('title')
      await comfyPage.nextFrame()
      await expect(panel.searchBox).toHaveValue('')
    })

    test('search resets in subgraph editor when selecting different subgraph', async ({
      comfyPage
    }) => {
      const { subgraphA, subgraphB } = await createTwoSubgraphs(comfyPage)

      await subgraphA.click('title')
      await comfyPage.nextFrame()
      await expect(panel.subgraphEditButton).toBeVisible()
      await panel.subgraphEditButton.click()
      await comfyPage.nextFrame()

      await panel.searchWidgets('seed')
      await expect(panel.searchBox).toHaveValue('seed')

      await subgraphB.click('title')
      await comfyPage.nextFrame()
      await expect(panel.searchBox).toHaveValue('')
    })

    test('search resets when going from subgraph to normal node', async ({
      comfyPage
    }) => {
      const { subgraphA } = await createTwoSubgraphs(comfyPage)

      await subgraphA.click('title')
      await comfyPage.nextFrame()
      await panel.searchWidgets('seed')
      await expect(panel.searchBox).toHaveValue('seed')

      await selectNodeById(comfyPage, '4')
      await expect(panel.searchBox).toHaveValue('')
    })

    test('search resets when deselecting all nodes', async ({ comfyPage }) => {
      const { subgraphA } = await createTwoSubgraphs(comfyPage)

      await subgraphA.click('title')
      await comfyPage.nextFrame()
      await panel.searchWidgets('seed')
      await expect(panel.searchBox).toHaveValue('seed')

      await comfyPage.canvasOps.click({ x: 10, y: 10 })
      await comfyPage.nextFrame()
      await expect(panel.searchBox).toHaveValue('')
    })

    test('search resets when going from no selection to node selection', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('default')
      await comfyPage.nextFrame()

      await panel.searchWidgets('seed')
      await expect(panel.searchBox).toHaveValue('seed')

      await selectNodeById(comfyPage, '3')
      await expect(panel.searchBox).toHaveValue('')
    })

    test('search resets when switching tabs', async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('default')
      await comfyPage.nextFrame()
      await selectNodeById(comfyPage, '3')

      await panel.searchWidgets('seed')
      await expect(panel.searchBox).toHaveValue('seed')

      await panel.switchToTab('Settings')
      await expect(panel.searchBox).toHaveValue('')
    })

    test('search resets when toggling subgraph editor mode', async ({
      comfyPage
    }) => {
      const { subgraphA } = await createTwoSubgraphs(comfyPage)

      await subgraphA.click('title')
      await comfyPage.nextFrame()
      await expect(panel.subgraphEditButton).toBeVisible()

      await panel.searchWidgets('seed')
      await expect(panel.searchBox).toHaveValue('seed')

      await panel.subgraphEditButton.click()
      await comfyPage.nextFrame()
      await expect(panel.searchBox).toHaveValue('')
    })

    test('search resets when switching between normal nodes', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('default')
      await comfyPage.nextFrame()

      await selectNodeById(comfyPage, '3')
      await panel.searchWidgets('seed')
      await expect(panel.searchBox).toHaveValue('seed')

      await selectNodeById(comfyPage, '4')
      await expect(panel.searchBox).toHaveValue('')
    })

    test('widgets render immediately after subgraph switch without flicker', async ({
      comfyPage
    }) => {
      const { subgraphA, subgraphB } = await createTwoSubgraphs(comfyPage)

      await subgraphA.click('title')
      await comfyPage.nextFrame()
      await panel.searchWidgets('seed')
      await expect(panel.searchBox).toHaveValue('seed')

      await subgraphB.click('title')
      await comfyPage.nextFrame()
      await expect(panel.searchBox).toHaveValue('')
      await expect(panel.contentArea).toBeVisible()
      await expect
        .poll(() => panel.contentArea.getByText('text').count())
        .toBeGreaterThan(0)
    })

    test('search works correctly in new subgraph after switching', async ({
      comfyPage
    }) => {
      const { subgraphA, subgraphB } = await createTwoSubgraphs(comfyPage)

      await subgraphA.click('title')
      await comfyPage.nextFrame()
      await panel.searchWidgets('seed')
      await expect(panel.searchBox).toHaveValue('seed')

      await subgraphB.click('title')
      await comfyPage.nextFrame()
      await expect(panel.searchBox).toHaveValue('')

      await panel.searchWidgets('seed')
      await expect(panel.searchBox).toHaveValue('seed')
      await expect
        .poll(() =>
          panel.contentArea
            .getByText(/no .* match|no results|no items/i)
            .count()
        )
        .toBeGreaterThan(0)
    })
  }
)
