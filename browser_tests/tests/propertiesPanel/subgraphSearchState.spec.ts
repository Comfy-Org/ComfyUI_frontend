import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import type { NodeReference } from '@e2e/fixtures/utils/litegraphUtils'
import { PropertiesPanelHelper } from '@e2e/tests/propertiesPanel/PropertiesPanelHelper'

// Static workflow with two sibling subgraph instances (ids 2 and 4) plus a
// normal node (EmptyLatentImage, id 3). Using a premade fixture keeps these
// tests deterministic — no flaky runtime "Convert to Subgraph" context-menu
// dance to build the graph.
const TWO_SUBGRAPHS = 'subgraphs/two-subgraphs-with-normal-node'
const SUBGRAPH_A_ID = '2'
const NORMAL_NODE_ID = '3'
const SUBGRAPH_B_ID = '4'

async function loadTwoSubgraphs(comfyPage: ComfyPage): Promise<{
  subgraphA: NodeReference
  subgraphB: NodeReference
}> {
  await comfyPage.workflow.loadWorkflow(TWO_SUBGRAPHS)
  await comfyPage.nextFrame()
  const subgraphA = await comfyPage.nodeOps.getNodeRefById(SUBGRAPH_A_ID)
  const subgraphB = await comfyPage.nodeOps.getNodeRefById(SUBGRAPH_B_ID)
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
      const { subgraphA, subgraphB } = await loadTwoSubgraphs(comfyPage)

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
      const { subgraphA, subgraphB } = await loadTwoSubgraphs(comfyPage)

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
      const { subgraphA } = await loadTwoSubgraphs(comfyPage)

      await subgraphA.click('title')
      await comfyPage.nextFrame()
      await panel.searchWidgets('seed')
      await expect(panel.searchBox).toHaveValue('seed')

      await selectNodeById(comfyPage, NORMAL_NODE_ID)
      await expect(panel.searchBox).toHaveValue('')
    })

    test('search resets when deselecting all nodes', async ({ comfyPage }) => {
      const { subgraphA } = await loadTwoSubgraphs(comfyPage)

      await subgraphA.click('title')
      await comfyPage.nextFrame()
      await panel.searchWidgets('seed')
      await expect(panel.searchBox).toHaveValue('seed')

      // Deselect all via page.evaluate to avoid workflow-tab overlay
      // intercepting a top-left empty-space click.
      await comfyPage.page.evaluate(() => {
        window.app!.canvas.deselectAll()
      })
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

    test('search resets after switching away and back to a tab', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('default')
      await comfyPage.nextFrame()
      await selectNodeById(comfyPage, '3')

      await panel.searchWidgets('seed')
      await expect(panel.searchBox).toHaveValue('seed')

      await panel.switchToTab('Settings')
      await expect(panel.searchBox).toBeHidden()

      await panel.switchToTab('Parameters')
      await expect(panel.searchBox).toHaveValue('')
    })

    test('search resets when toggling subgraph editor mode', async ({
      comfyPage
    }) => {
      const { subgraphA } = await loadTwoSubgraphs(comfyPage)

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

    test('panel renders without stale search after subgraph switch', async ({
      comfyPage
    }) => {
      const { subgraphA, subgraphB } = await loadTwoSubgraphs(comfyPage)

      await subgraphA.click('title')
      await comfyPage.nextFrame()
      await panel.searchWidgets('seed')
      await expect(panel.searchBox).toHaveValue('seed')

      await subgraphB.click('title')
      await comfyPage.nextFrame()
      // Remount on identity change clears search state and re-renders the
      // panel body immediately (no stale query bleeding into the new context).
      await expect(panel.searchBox).toHaveValue('')
      await expect(panel.contentArea).toBeVisible()
    })

    test('search remains functional in the new subgraph after switching', async ({
      comfyPage
    }) => {
      const { subgraphA, subgraphB } = await loadTwoSubgraphs(comfyPage)

      await subgraphA.click('title')
      await comfyPage.nextFrame()
      await panel.searchWidgets('seed')
      await expect(panel.searchBox).toHaveValue('seed')

      await subgraphB.click('title')
      await comfyPage.nextFrame()
      await expect(panel.searchBox).toHaveValue('')

      // The freshly-mounted search box is fully functional and scoped to B.
      await panel.searchWidgets('seed')
      await expect(panel.searchBox).toHaveValue('seed')
      await expect(panel.contentArea).toBeVisible()
    })
  }
)
