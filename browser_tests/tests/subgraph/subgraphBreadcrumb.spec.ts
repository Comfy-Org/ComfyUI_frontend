import { expect, mergeTests } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { subgraphBreadcrumbFixture } from '@e2e/fixtures/helpers/SubgraphBreadcrumbHelper'

const test = mergeTests(comfyPageFixture, subgraphBreadcrumbFixture)

const NESTED_WORKFLOW = 'subgraphs/nested-subgraph'
const SUBGRAPH_2_ID = '8beb610f-ddd1-4489-ae0d-2f732a4042ae'
const SUBGRAPH_3_ID = 'dbe5763f-440b-47b4-82ac-454f1f98b0e3'
const SUBGRAPH_2_NAME = 'subgraph 2'
const SUBGRAPH_3_NAME = 'subgraph 3'

const BASIC_WORKFLOW = 'subgraphs/basic-subgraph'
const BASIC_SUBGRAPH_NODE_ID = '2'
const OUTER_SUBGRAPH_NODE_ID_IN_NESTED = '10'

const MISSING_NODES_WORKFLOW = 'missing/missing_nodes_in_subgraph'
const MISSING_NODES_SUBGRAPH_ID = 'subgraph-with-missing-node'
const MISSING_NODES_SUBGRAPH_NODE_ID = '2'

/**
 * Descend two subgraph levels by double-clicking the outer subgraph node in
 * the root graph, then the inner subgraph node that appears inside. Matches
 * how a user navigates via the canvas.
 */
const enterNestedSubgraphs = async (comfyPage: ComfyPage) => {
  const outerNode = await comfyPage.nodeOps.getNodeRefById(
    OUTER_SUBGRAPH_NODE_ID_IN_NESTED
  )
  await outerNode.navigateIntoSubgraph()

  await expect
    .poll(() => comfyPage.subgraph.getActiveGraphId())
    .toBe(SUBGRAPH_2_ID)

  const innerSubgraphNodeId = await comfyPage.subgraph.findSubgraphNodeId()
  const innerNode = await comfyPage.nodeOps.getNodeRefById(innerSubgraphNodeId)
  await innerNode.centerOnNode()
  await innerNode.navigateIntoSubgraph()

  await expect
    .poll(() => comfyPage.subgraph.getActiveGraphId())
    .toBe(SUBGRAPH_3_ID)
}

test.describe('Subgraph Breadcrumb', { tag: ['@subgraph'] }, () => {
  test('hides back button at root graph and shows it inside a subgraph', async ({
    comfyPage,
    subgraphBreadcrumb
  }) => {
    await test.step('Load workflow with a subgraph', async () => {
      await comfyPage.workflow.loadWorkflow(BASIC_WORKFLOW)
    })

    await test.step('Back button is not rendered at root graph', async () => {
      await expect(subgraphBreadcrumb.panel.backButton).toHaveCount(0)
    })

    await test.step('Entering a subgraph reveals the back button', async () => {
      const subgraphNode = await comfyPage.nodeOps.getNodeRefById(
        BASIC_SUBGRAPH_NODE_ID
      )
      await subgraphNode.navigateIntoSubgraph()

      await expect(subgraphBreadcrumb.panel.backButton).toBeVisible()
    })
  })

  test('clicking the back button exits one subgraph level', async ({
    comfyPage,
    subgraphBreadcrumb
  }) => {
    await comfyPage.workflow.loadWorkflow(NESTED_WORKFLOW)

    await test.step('Descend to the deepest nested subgraph', async () => {
      await enterNestedSubgraphs(comfyPage)
    })

    await test.step('Back button pops one level', async () => {
      await subgraphBreadcrumb.clickBack()

      await expect
        .poll(() => comfyPage.subgraph.getActiveGraphId())
        .toBe(SUBGRAPH_2_ID)
      await expect(subgraphBreadcrumb.panel.backButton).toBeVisible()
    })

    await test.step('Back button from final subgraph returns to root', async () => {
      await subgraphBreadcrumb.clickBack()

      await expect.poll(() => comfyPage.subgraph.isInSubgraph()).toBe(false)
      await expect(subgraphBreadcrumb.panel.backButton).toHaveCount(0)
    })
  })

  test('clicking a non-active breadcrumb item navigates directly to that level', async ({
    comfyPage,
    subgraphBreadcrumb
  }) => {
    await comfyPage.workflow.loadWorkflow(NESTED_WORKFLOW)
    await enterNestedSubgraphs(comfyPage)

    await test.step('Click the middle (subgraph 2) item', async () => {
      await subgraphBreadcrumb.clickItem(`subgraph-${SUBGRAPH_2_ID}`)

      await expect
        .poll(() => comfyPage.subgraph.getActiveGraphId())
        .toBe(SUBGRAPH_2_ID)
    })

    await test.step('Active item reflects the new level', async () => {
      await expect(subgraphBreadcrumb.panel.activeItem).toHaveAttribute(
        'data-testid',
        `subgraph-breadcrumb-item-subgraph-${SUBGRAPH_2_ID}`
      )
    })
  })

  test('clicking the root breadcrumb item returns to the root graph', async ({
    comfyPage,
    subgraphBreadcrumb
  }) => {
    await comfyPage.workflow.loadWorkflow(BASIC_WORKFLOW)

    const rootGraphId = await comfyPage.subgraph.getRootGraphId()
    expect(
      rootGraphId,
      'Root graph id should be readable before navigating'
    ).not.toBeNull()

    const subgraphNode = await comfyPage.nodeOps.getNodeRefById(
      BASIC_SUBGRAPH_NODE_ID
    )
    await subgraphNode.navigateIntoSubgraph()
    await expect.poll(() => comfyPage.subgraph.isInSubgraph()).toBe(true)

    await subgraphBreadcrumb.clickItem('root')

    await expect
      .poll(() => comfyPage.subgraph.getActiveGraphId())
      .toBe(rootGraphId)
    await expect.poll(() => comfyPage.subgraph.isInSubgraph()).toBe(false)
  })

  test('clicking the active breadcrumb item opens the workflow actions menu', async ({
    comfyPage,
    subgraphBreadcrumb
  }) => {
    await comfyPage.workflow.loadWorkflow(BASIC_WORKFLOW)

    const subgraphNode = await comfyPage.nodeOps.getNodeRefById(
      BASIC_SUBGRAPH_NODE_ID
    )
    await subgraphNode.navigateIntoSubgraph()
    await expect.poll(() => comfyPage.subgraph.isInSubgraph()).toBe(true)

    const activeGraphId = await comfyPage.subgraph.getActiveGraphId()
    expect(activeGraphId).not.toBeNull()
    const menuKey = `subgraph-${activeGraphId}`

    await subgraphBreadcrumb.openActiveItemMenu(menuKey)

    await expect(
      subgraphBreadcrumb.panel.menuItemByLabel(menuKey, 'Rename')
    ).toBeVisible()
  })

  test('double-clicking the active item renames the subgraph', async ({
    comfyPage,
    subgraphBreadcrumb
  }) => {
    await comfyPage.workflow.loadWorkflow(NESTED_WORKFLOW)
    const outerNode = await comfyPage.nodeOps.getNodeRefById(
      OUTER_SUBGRAPH_NODE_ID_IN_NESTED
    )
    await outerNode.navigateIntoSubgraph()
    await expect
      .poll(() => comfyPage.subgraph.getActiveGraphId())
      .toBe(SUBGRAPH_2_ID)
    await expect(subgraphBreadcrumb.panel.activeItem).toContainText(
      SUBGRAPH_2_NAME
    )

    const newName = 'Renamed Subgraph'

    await subgraphBreadcrumb.startRenameActiveItem()
    await subgraphBreadcrumb.commitRename(newName)

    await test.step('Breadcrumb label updates', async () => {
      await expect(subgraphBreadcrumb.panel.activeItem).toContainText(newName)
    })

    await test.step('Subgraph node title on the root graph syncs', async () => {
      await subgraphBreadcrumb.clickItem('root')
      await expect.poll(() => comfyPage.subgraph.isInSubgraph()).toBe(false)

      const rootNodeTitle = await comfyPage.page.evaluate(
        (nodeId) => window.app!.graph!.getNodeById(nodeId)?.title ?? null,
        OUTER_SUBGRAPH_NODE_ID_IN_NESTED
      )
      expect(rootNodeTitle).toBe(newName)
    })
  })

  test('pressing Escape while renaming cancels the change', async ({
    comfyPage,
    subgraphBreadcrumb
  }) => {
    await comfyPage.workflow.loadWorkflow(NESTED_WORKFLOW)
    const outerNode = await comfyPage.nodeOps.getNodeRefById(
      OUTER_SUBGRAPH_NODE_ID_IN_NESTED
    )
    await outerNode.navigateIntoSubgraph()

    await subgraphBreadcrumb.startRenameActiveItem()
    await subgraphBreadcrumb.panel.renameInput.fill('Discarded Name')
    await subgraphBreadcrumb.cancelRename()

    await expect(subgraphBreadcrumb.panel.activeItem).toContainText(
      SUBGRAPH_2_NAME
    )
    await expect(subgraphBreadcrumb.panel.activeItem).not.toContainText(
      'Discarded Name'
    )
  })

  test('root breadcrumb item shows missing-nodes warning for a workflow with missing nodes', async ({
    comfyPage,
    subgraphBreadcrumb
  }) => {
    await comfyPage.workflow.loadWorkflow(MISSING_NODES_WORKFLOW)

    const subgraphNode = await comfyPage.nodeOps.getNodeRefById(
      MISSING_NODES_SUBGRAPH_NODE_ID
    )
    await subgraphNode.navigateIntoSubgraph()

    await expect
      .poll(() => comfyPage.subgraph.getActiveGraphId())
      .toBe(MISSING_NODES_SUBGRAPH_ID)

    await expect(subgraphBreadcrumb.panel.missingNodesIcon).toBeVisible()
  })

  test('nested breadcrumb renders root + each subgraph level', async ({
    comfyPage,
    subgraphBreadcrumb
  }) => {
    await comfyPage.workflow.loadWorkflow(NESTED_WORKFLOW)
    await enterNestedSubgraphs(comfyPage)

    await expect(subgraphBreadcrumb.panel.rootItem()).toBeAttached()
    await expect(
      subgraphBreadcrumb.panel.subgraphItem(SUBGRAPH_2_ID)
    ).toContainText(SUBGRAPH_2_NAME)
    await expect(
      subgraphBreadcrumb.panel.subgraphItem(SUBGRAPH_3_ID)
    ).toContainText(SUBGRAPH_3_NAME)

    await expect(subgraphBreadcrumb.panel.activeItem).toHaveAttribute(
      'data-testid',
      `subgraph-breadcrumb-item-subgraph-${SUBGRAPH_3_ID}`
    )
  })

  test('collapses when overflowing and expands when there is room', async ({
    comfyPage,
    subgraphBreadcrumb
  }) => {
    const { panel } = subgraphBreadcrumb
    const rootItem = panel.rootItem()
    const subgraph2Item = panel.subgraphItem(SUBGRAPH_2_ID)
    const subgraph3Item = panel.subgraphItem(SUBGRAPH_3_ID)
    const originalViewport = comfyPage.page.viewportSize()
    expect(
      originalViewport,
      'Viewport size should be known before resizing'
    ).not.toBeNull()

    await comfyPage.workflow.loadWorkflow(NESTED_WORKFLOW)
    await enterNestedSubgraphs(comfyPage)

    await test.step('All items visible at default width', async () => {
      await expect(panel.root).not.toHaveClass(/subgraph-breadcrumb-collapse/)
      await expect(rootItem).toBeVisible()
      await expect(subgraph2Item).toBeVisible()
      await expect(subgraph3Item).toBeVisible()
    })

    await test.step('Shrinking the viewport collapses middle items', async () => {
      await comfyPage.page.setViewportSize({
        width: 680,
        height: originalViewport!.height
      })

      await expect(panel.root).toHaveClass(/subgraph-breadcrumb-collapse/)
      await expect(rootItem).toBeHidden()
      await expect(subgraph2Item).toBeVisible()
      await expect(subgraph3Item).toBeVisible()
    })

    await test.step('Restoring the viewport expands the breadcrumb again', async () => {
      await comfyPage.page.setViewportSize(originalViewport!)

      await expect(panel.root).not.toHaveClass(/subgraph-breadcrumb-collapse/)
      await expect(rootItem).toBeVisible()
      await expect(subgraph2Item).toBeVisible()
      await expect(subgraph3Item).toBeVisible()
    })
  })
})
