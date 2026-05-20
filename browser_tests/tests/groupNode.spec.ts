import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { NodeLibrarySidebarTab } from '@e2e/fixtures/components/SidebarTab'
import { TestIds } from '@e2e/fixtures/selectors'
import type { NodeReference } from '@e2e/fixtures/utils/litegraphUtils'

const LOADED_WORKFLOW = 'groupnodes/group_node_v1.3.3'
const GROUP_NODE_NAME = 'group_node'
const GROUP_NODE_CATEGORY = 'group nodes>workflow'
const GROUP_NODE_TYPE = `workflow>${GROUP_NODE_NAME}`
const GROUP_NODE_BOOKMARK = GROUP_NODE_TYPE

test.beforeEach(async ({ comfyPage }) => {
  await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
  await comfyPage.settings.setSetting('Comfy.NodeLibrary.NewDesign', false)
  await comfyPage.settings.setSetting('Comfy.NodeSearchBoxImpl', 'v1 (legacy)')
})

test.describe('Group Node', { tag: '@node' }, () => {
  test.describe('Node library sidebar', () => {
    let libraryTab: NodeLibrarySidebarTab

    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
      libraryTab = comfyPage.menu.nodeLibraryTab
      await comfyPage.workflow.loadWorkflow(LOADED_WORKFLOW)
      await libraryTab.open()
    })

    test('Is added to node library sidebar', async ({
      comfyPage: _comfyPage
    }) => {
      await expect(libraryTab.getFolder(GROUP_NODE_CATEGORY)).toHaveCount(1)
    })

    test('Can be added to canvas using node library sidebar', async ({
      comfyPage
    }) => {
      const initialNodeCount = await comfyPage.nodeOps.getGraphNodesCount()

      await libraryTab.getFolder(GROUP_NODE_CATEGORY).click()
      await libraryTab.getNode(GROUP_NODE_NAME).click()

      // Verify the node is added to the canvas
      await expect
        .poll(() => comfyPage.nodeOps.getGraphNodesCount())
        .toBe(initialNodeCount + 1)
    })

    test('Can be bookmarked and unbookmarked', async ({ comfyPage }) => {
      await libraryTab.getFolder(GROUP_NODE_CATEGORY).click()
      await libraryTab
        .getNode(GROUP_NODE_NAME)
        .locator('.bookmark-button')
        .click()

      // Verify the node is added to the bookmarks tab
      await expect
        .poll(() =>
          comfyPage.settings.getSetting('Comfy.NodeLibrary.Bookmarks.V2')
        )
        .toEqual([GROUP_NODE_BOOKMARK])
      // Verify the bookmark node with the same name is added to the tree
      await expect(libraryTab.getNode(GROUP_NODE_NAME)).not.toHaveCount(0)

      await libraryTab
        .getNode(GROUP_NODE_NAME)
        .locator('.bookmark-button')
        .first()
        .click()

      // Verify the node is removed from the bookmarks tab
      await expect
        .poll(() =>
          comfyPage.settings.getSetting('Comfy.NodeLibrary.Bookmarks.V2')
        )
        .toHaveLength(0)
    })

    test('Displays preview on bookmark hover', async ({ comfyPage }) => {
      await libraryTab.getFolder(GROUP_NODE_CATEGORY).click()
      await libraryTab
        .getNode(GROUP_NODE_NAME)
        .locator('.bookmark-button')
        .click()
      await comfyPage.page
        .locator('.p-tree-node-label.tree-explorer-node-label')
        .first()
        .hover()
      await expect(
        comfyPage.page.locator('.node-lib-node-preview')
      ).toBeVisible()
      await libraryTab
        .getNode(GROUP_NODE_NAME)
        .locator('.bookmark-button')
        .first()
        .click()
    })
  })

  test('Can be added to canvas using search', async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow(LOADED_WORKFLOW)
    await comfyPage.canvasOps.doubleClick()
    await comfyPage.nextFrame()
    await comfyPage.searchBox.input.waitFor({ state: 'visible' })
    await comfyPage.searchBox.input.fill(GROUP_NODE_NAME)
    await comfyPage.searchBox.dropdown.waitFor({ state: 'visible' })

    const exactGroupNodeResult = comfyPage.searchBox.dropdown
      .locator(`li[aria-label="${GROUP_NODE_NAME}"]`)
      .first()
    await expect(exactGroupNodeResult).toBeVisible()
    await exactGroupNodeResult.click()

    await expect
      .poll(() => comfyPage.nodeOps.getNodeRefsByType(GROUP_NODE_TYPE))
      .toHaveLength(2)
  })

  test('Displays tooltip on title hover', async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.EnableTooltips', true)
    await comfyPage.workflow.loadWorkflow(LOADED_WORKFLOW)
    const groupNode = await comfyPage.nodeOps.getFirstNodeRef()
    if (!groupNode)
      throw new Error(`Group node not found in workflow ${LOADED_WORKFLOW}`)
    const pos = await groupNode.getPosition()
    await comfyPage.page.mouse.move(pos.x + 40, pos.y + 10)
    await expect(comfyPage.page.locator('.node-tooltip')).toBeVisible()
  })

  test('Manage group opens with the correct group selected', async ({
    comfyPage
  }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
    await comfyPage.workflow.loadWorkflow(LOADED_WORKFLOW)
    const groupNode = await comfyPage.nodeOps.getFirstNodeRef()
    if (!groupNode)
      throw new Error(`Group node not found in workflow ${LOADED_WORKFLOW}`)

    const manage = await groupNode.manageGroupNode()
    await comfyPage.nextFrame()
    await expect(manage.selectedNodeTypeSelect).toHaveValue(GROUP_NODE_NAME)
    await manage.close()
    await expect(manage.root).toBeHidden()
  })

  test('Preserves hidden input configuration when containing duplicate node types', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow(
      'groupnodes/group_node_identical_nodes_hidden_inputs'
    )

    const groupNodeId = 19
    const groupNodeName = 'two_VAE_decode'

    // Verify there are 4 total inputs (2 VAE decode nodes with 2 inputs each)
    await expect
      .poll(() =>
        comfyPage.page.evaluate((nodeName) => {
          const {
            extra: { groupNodes }
          } = window.app!.graph!
          const { nodes } = groupNodes![nodeName]
          return nodes.reduce(
            (acc, node) => acc + (node.inputs?.length ?? 0),
            0
          )
        }, groupNodeName)
      )
      .toBe(4)

    // Verify there are 2 visible inputs (2 have been hidden in config)
    await expect
      .poll(() =>
        comfyPage.page.evaluate((id) => {
          const node = window.app!.graph!.getNodeById(id)
          return node!.inputs.length
        }, groupNodeId)
      )
      .toBe(2)
  })

  test('Loads from a workflow using the legacy path separator ("/")', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('groupnodes/legacy_group_node')
    await expect.poll(() => comfyPage.nodeOps.getGraphNodesCount()).toBe(1)
    await expect(
      comfyPage.page.getByTestId(TestIds.dialogs.errorOverlay)
    ).toBeHidden()
  })

  test.describe('Copy and paste', () => {
    let groupNode: NodeReference | null

    const isRegisteredLitegraph = async (comfyPage: ComfyPage) => {
      return await comfyPage.page.evaluate((nodeType: string) => {
        return !!window.LiteGraph!.registered_node_types[nodeType]
      }, GROUP_NODE_TYPE)
    }

    const isRegisteredNodeDefStore = async (comfyPage: ComfyPage) => {
      await comfyPage.menu.nodeLibraryTab.open()
      const groupNodesFolderCt = await comfyPage.menu.nodeLibraryTab
        .getFolder(GROUP_NODE_CATEGORY)
        .count()
      return groupNodesFolderCt === 1
    }

    const verifyNodeLoaded = async (
      comfyPage: ComfyPage,
      expectedCount: number
    ) => {
      expect(
        await comfyPage.nodeOps.getNodeRefsByType(GROUP_NODE_TYPE)
      ).toHaveLength(expectedCount)
      await expect.poll(() => isRegisteredLitegraph(comfyPage)).toBe(true)
      await expect.poll(() => isRegisteredNodeDefStore(comfyPage)).toBe(true)
    }

    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
      await comfyPage.workflow.loadWorkflow(LOADED_WORKFLOW)
      groupNode = await comfyPage.nodeOps.getFirstNodeRef()
      if (!groupNode)
        throw new Error(`Group node not found in workflow ${LOADED_WORKFLOW}`)
      await groupNode.copy()
    })

    test('Copies and pastes group node within the same workflow', async ({
      comfyPage
    }) => {
      await comfyPage.clipboard.paste()
      await verifyNodeLoaded(comfyPage, 2)
    })

    test('Copies and pastes group node after clearing workflow', async ({
      comfyPage
    }) => {
      await comfyPage.settings.setSetting('Comfy.ConfirmClear', false)
      await comfyPage.command.executeCommand('Comfy.ClearWorkflow')

      await comfyPage.clipboard.paste()
      await verifyNodeLoaded(comfyPage, 1)
    })

    test('Copies and pastes group node into a newly created blank workflow', async ({
      comfyPage
    }) => {
      await comfyPage.menu.topbar.triggerTopbarCommand(['New'])
      await comfyPage.clipboard.paste()
      await verifyNodeLoaded(comfyPage, 1)
    })

    test('Copies and pastes group node across different workflows', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('default')
      await comfyPage.clipboard.paste()
      await verifyNodeLoaded(comfyPage, 1)
    })

    test('Serializes group node after copy and paste across workflows', async ({
      comfyPage
    }) => {
      await comfyPage.menu.topbar.triggerTopbarCommand(['New'])
      await comfyPage.clipboard.paste()
      const currentGraphState = await comfyPage.page.evaluate(() =>
        window.app!.graph!.serialize()
      )

      await test.step('Load workflow containing a group node pasted from a different workflow', async () => {
        await comfyPage.workflow.loadGraphData(
          currentGraphState as ComfyWorkflowJSON
        )
        await verifyNodeLoaded(comfyPage, 1)
      })
    })
  })
})
