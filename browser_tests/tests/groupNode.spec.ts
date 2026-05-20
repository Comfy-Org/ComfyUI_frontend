import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'
import type { NodeReference } from '@e2e/fixtures/utils/litegraphUtils'

test.beforeEach(async ({ comfyPage }) => {
  await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
  await comfyPage.settings.setSetting('Comfy.NodeLibrary.NewDesign', false)
  await comfyPage.settings.setSetting('Comfy.NodeSearchBoxImpl', 'v1 (legacy)')
})

test.describe('Group Node', { tag: '@node' }, () => {
  test('Loads from a workflow using the legacy path separator ("/")', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('groupnodes/legacy_group_node')
    await expect.poll(() => comfyPage.nodeOps.getGraphNodesCount()).toBe(1)
    await expect(
      comfyPage.page.getByTestId(TestIds.dialogs.errorOverlay)
    ).toBeHidden()
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

  test('Manage Group Node dialog opens for an existing group node', async ({
    comfyPage
  }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
    await comfyPage.workflow.loadWorkflow('groupnodes/group_node_v1.3.3')

    const groupNode = await comfyPage.nodeOps.getFirstNodeRef()
    if (!groupNode) throw new Error('Group node not found in workflow')

    const manage = await groupNode.manageGroupNode()
    await comfyPage.nextFrame()
    await expect(manage.selectedNodeTypeSelect).toHaveValue('group_node')
    await manage.close()
    await expect(manage.root).toBeHidden()
  })

  test.describe('Copy and paste', () => {
    let groupNode: NodeReference | null
    const WORKFLOW_NAME = 'groupnodes/group_node_v1.3.3'
    const GROUP_NODE_CATEGORY = 'group nodes>workflow'
    const GROUP_NODE_PREFIX = 'workflow>'
    const GROUP_NODE_NAME = 'group_node' // Node name in given workflow
    const GROUP_NODE_TYPE = `${GROUP_NODE_PREFIX}${GROUP_NODE_NAME}`

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
      await comfyPage.workflow.loadWorkflow(WORKFLOW_NAME)
      groupNode = await comfyPage.nodeOps.getFirstNodeRef()
      if (!groupNode)
        throw new Error(`Group node not found in workflow ${WORKFLOW_NAME}`)
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
