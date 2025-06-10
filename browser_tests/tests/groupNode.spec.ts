import { expect } from '@playwright/test'

import { ComfyPage, comfyPageFixture as test } from '../fixtures/ComfyPage'
import type { NodeReference } from '../fixtures/utils/litegraphUtils'
import { PerformanceMonitor } from '../helpers/performanceMonitor'

test.describe('Group Node', () => {
  test.describe('Node library sidebar', () => {
    const groupNodeName = 'DefautWorkflowGroupNode'
    const groupNodeCategory = 'group nodes>workflow'
    const groupNodeBookmarkName = `workflow>${groupNodeName}`
    let libraryTab

    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.setSetting('Comfy.UseNewMenu', 'Top')
      libraryTab = comfyPage.menu.nodeLibraryTab
      await comfyPage.convertAllNodesToGroupNode(groupNodeName)
      await libraryTab.open()
    })

    test('Is added to node library sidebar', async ({ comfyPage }) => {
      expect(await libraryTab.getFolder('group nodes').count()).toBe(1)
    })

    test('@perf Can be added to canvas using node library sidebar', async ({
      comfyPage
    }) => {
      const perfMonitor = new PerformanceMonitor(comfyPage.page)
      const testName = 'add-group-node-from-library'

      await perfMonitor.startMonitoring(testName)

      const initialNodeCount = await comfyPage.getGraphNodesCount()

      // Add group node from node library sidebar
      await perfMonitor.measureOperation('expand-category-folder', async () => {
        await libraryTab.getFolder(groupNodeCategory).click()
      })

      await perfMonitor.measureOperation('add-node-from-library', async () => {
        await libraryTab.getNode(groupNodeName).click()
      })

      // Verify the node is added to the canvas
      expect(await comfyPage.getGraphNodesCount()).toBe(initialNodeCount + 1)

      await perfMonitor.finishMonitoring(testName)
    })

    test('@perf Can be bookmarked and unbookmarked', async ({ comfyPage }) => {
      const perfMonitor = new PerformanceMonitor(comfyPage.page)
      const testName = 'bookmark-unbookmark-group-node'

      await perfMonitor.startMonitoring(testName)

      await perfMonitor.measureOperation('expand-category-folder', async () => {
        await libraryTab.getFolder(groupNodeCategory).click()
      })

      await perfMonitor.measureOperation('bookmark-node', async () => {
        await libraryTab
          .getNode(groupNodeName)
          .locator('.bookmark-button')
          .click()
      })

      // Verify the node is added to the bookmarks tab
      expect(
        await comfyPage.getSetting('Comfy.NodeLibrary.Bookmarks.V2')
      ).toEqual([groupNodeBookmarkName])
      // Verify the bookmark node with the same name is added to the tree
      expect(await libraryTab.getNode(groupNodeName).count()).not.toBe(0)

      // Unbookmark the node
      await perfMonitor.measureOperation('unbookmark-node', async () => {
        await libraryTab
          .getNode(groupNodeName)
          .locator('.bookmark-button')
          .first()
          .click()
      })

      // Verify the node is removed from the bookmarks tab
      expect(
        await comfyPage.getSetting('Comfy.NodeLibrary.Bookmarks.V2')
      ).toHaveLength(0)

      await perfMonitor.finishMonitoring(testName)
    })

    test('Displays preview on bookmark hover', async ({ comfyPage }) => {
      await libraryTab.getFolder(groupNodeCategory).click()
      await libraryTab
        .getNode(groupNodeName)
        .locator('.bookmark-button')
        .click()
      await comfyPage.page.hover('.p-tree-node-label.tree-explorer-node-label')
      expect(await comfyPage.page.isVisible('.node-lib-node-preview')).toBe(
        true
      )
      await libraryTab
        .getNode(groupNodeName)
        .locator('.bookmark-button')
        .first()
        .click()
    })
  })
  // The 500ms fixed delay on the search results is causing flakiness
  // Potential solution: add a spinner state when the search is in progress,
  // and observe that state from the test. Blocker: the PrimeVue AutoComplete
  // does not have a v-model on the query, so we cannot observe the raw
  // query update, and thus cannot set the spinning state between the raw query
  // update and the debounced search update.
  test.skip('Can be added to canvas using search', async ({ comfyPage }) => {
    const groupNodeName = 'DefautWorkflowGroupNode'
    await comfyPage.convertAllNodesToGroupNode(groupNodeName)
    await comfyPage.doubleClickCanvas()
    await comfyPage.nextFrame()
    await comfyPage.searchBox.fillAndSelectFirstNode(groupNodeName)
    await expect(comfyPage.canvas).toHaveScreenshot(
      'group-node-copy-added-from-search.png'
    )
  })

  test('@perf Displays tooltip on title hover', async ({ comfyPage }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'group-node-tooltip-display'

    await perfMonitor.startMonitoring(testName)

    await comfyPage.setSetting('Comfy.EnableTooltips', true)

    await perfMonitor.measureOperation('convert-to-group-node', async () => {
      await comfyPage.convertAllNodesToGroupNode('Group Node')
    })

    await perfMonitor.measureOperation('hover-for-tooltip', async () => {
      await comfyPage.page.mouse.move(47, 173)
      const tooltipTimeout = 500
      await comfyPage.page.waitForTimeout(tooltipTimeout + 16)
    })

    await expect(comfyPage.page.locator('.node-tooltip')).toBeVisible()

    await perfMonitor.finishMonitoring(testName)
  })

  test('@perf Manage group opens with the correct group selected', async ({
    comfyPage
  }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'manage-group-node-selection'

    await perfMonitor.startMonitoring(testName)

    const makeGroup = async (name, type1, type2) => {
      const node1 = (await comfyPage.getNodeRefsByType(type1))[0]
      const node2 = (await comfyPage.getNodeRefsByType(type2))[0]
      await node1.click('title')
      await node2.click('title', {
        modifiers: ['Shift']
      })
      return await node2.convertToGroupNode(name)
    }

    let group1
    await perfMonitor.measureOperation('create-first-group', async () => {
      group1 = await makeGroup('g1', 'CLIPTextEncode', 'CheckpointLoaderSimple')
    })

    let group2
    await perfMonitor.measureOperation('create-second-group', async () => {
      group2 = await makeGroup('g2', 'EmptyLatentImage', 'KSampler')
    })

    let manage1
    await perfMonitor.measureOperation('open-first-manage-dialog', async () => {
      manage1 = await group1.manageGroupNode()
      await comfyPage.nextFrame()
    })

    expect(await manage1.getSelectedNodeType()).toBe('g1')

    await perfMonitor.measureOperation(
      'close-first-manage-dialog',
      async () => {
        await manage1.close()
      }
    )

    await expect(manage1.root).not.toBeVisible()

    let manage2
    await perfMonitor.measureOperation(
      'open-second-manage-dialog',
      async () => {
        manage2 = await group2.manageGroupNode()
      }
    )

    expect(await manage2.getSelectedNodeType()).toBe('g2')

    await perfMonitor.finishMonitoring(testName)
  })

  test('Preserves hidden input configuration when containing duplicate node types', async ({
    comfyPage
  }) => {
    await comfyPage.loadWorkflow('group_node_identical_nodes_hidden_inputs')
    await comfyPage.nextFrame()

    const groupNodeId = 19
    const groupNodeName = 'two_VAE_decode'

    const totalInputCount = await comfyPage.page.evaluate((nodeName) => {
      const {
        extra: { groupNodes }
      } = window['app'].graph
      const { nodes } = groupNodes[nodeName]
      return nodes.reduce((acc: number, node) => {
        return acc + node.inputs.length
      }, 0)
    }, groupNodeName)

    const visibleInputCount = await comfyPage.page.evaluate((id) => {
      const node = window['app'].graph.getNodeById(id)
      return node.inputs.length
    }, groupNodeId)

    // Verify there are 4 total inputs (2 VAE decode nodes with 2 inputs each)
    expect(totalInputCount).toBe(4)

    // Verify there are 2 visible inputs (2 have been hidden in config)
    expect(visibleInputCount).toBe(2)
  })

  test('@perf Reconnects inputs after configuration changed via manage dialog save', async ({
    comfyPage
  }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'reconnect-inputs-after-config-change'

    await perfMonitor.startMonitoring(testName)

    const expectSingleNode = async (type: string) => {
      const nodes = await comfyPage.getNodeRefsByType(type)
      expect(nodes).toHaveLength(1)
      return nodes[0]
    }
    const latent = await expectSingleNode('EmptyLatentImage')
    const sampler = await expectSingleNode('KSampler')

    // Remove existing link
    const samplerInput = await sampler.getInput(0)
    await perfMonitor.measureOperation('remove-existing-links', async () => {
      await samplerInput.removeLinks()
    })

    // Group latent + sampler
    await perfMonitor.measureOperation('select-nodes-for-group', async () => {
      await latent.click('title', {
        modifiers: ['Shift']
      })
      await sampler.click('title', {
        modifiers: ['Shift']
      })
    })

    let groupNode
    await perfMonitor.measureOperation('convert-to-group-node', async () => {
      groupNode = await sampler.convertToGroupNode()
    })

    // Connect node to group
    const ckpt = await expectSingleNode('CheckpointLoaderSimple')
    let input
    await perfMonitor.measureOperation('connect-nodes', async () => {
      input = await ckpt.connectOutput(0, groupNode, 0)
    })

    expect(await input.getLinkCount()).toBe(1)

    // Modify the group node via manage dialog
    await perfMonitor.markEvent('before-manage-dialog')

    let manage
    await perfMonitor.measureOperation('open-manage-dialog', async () => {
      manage = await groupNode.manageGroupNode()
    })

    await perfMonitor.measureOperation(
      'configure-in-manage-dialog',
      async () => {
        await manage.selectNode('KSampler')
        await manage.changeTab('Inputs')
        await manage.setLabel('model', 'test')
        await manage.save()
      }
    )

    await perfMonitor.measureOperation('close-manage-dialog', async () => {
      await manage.close()
    })

    await perfMonitor.markEvent('after-manage-dialog')

    // Ensure the link is still present
    expect(await input.getLinkCount()).toBe(1)

    await perfMonitor.finishMonitoring(testName)
  })

  test('Loads from a workflow using the legacy path separator ("/")', async ({
    comfyPage
  }) => {
    await comfyPage.loadWorkflow('legacy_group_node')
    expect(await comfyPage.getGraphNodesCount()).toBe(1)
    await expect(
      comfyPage.page.locator('.comfy-missing-nodes')
    ).not.toBeVisible()
  })

  test.describe('Copy and paste', () => {
    let groupNode: NodeReference | null
    const WORKFLOW_NAME = 'group_node_v1.3.3'
    const GROUP_NODE_CATEGORY = 'group nodes>workflow'
    const GROUP_NODE_PREFIX = 'workflow>'
    const GROUP_NODE_NAME = 'group_node' // Node name in given workflow
    const GROUP_NODE_TYPE = `${GROUP_NODE_PREFIX}${GROUP_NODE_NAME}`

    const isRegisteredLitegraph = async (comfyPage: ComfyPage) => {
      return await comfyPage.page.evaluate((nodeType: string) => {
        return !!window['LiteGraph'].registered_node_types[nodeType]
      }, GROUP_NODE_TYPE)
    }

    const isRegisteredNodeDefStore = async (comfyPage: ComfyPage) => {
      const groupNodesFolderCt = await comfyPage.menu.nodeLibraryTab
        .getFolder(GROUP_NODE_CATEGORY)
        .count()
      return groupNodesFolderCt === 1
    }

    const verifyNodeLoaded = async (
      comfyPage: ComfyPage,
      expectedCount: number
    ) => {
      expect(await comfyPage.getNodeRefsByType(GROUP_NODE_TYPE)).toHaveLength(
        expectedCount
      )
      expect(await isRegisteredLitegraph(comfyPage)).toBe(true)
      expect(await isRegisteredNodeDefStore(comfyPage)).toBe(true)
    }

    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.setSetting('Comfy.UseNewMenu', 'Top')
      await comfyPage.loadWorkflow(WORKFLOW_NAME)
      await comfyPage.menu.nodeLibraryTab.open()

      groupNode = await comfyPage.getFirstNodeRef()
      if (!groupNode)
        throw new Error(`Group node not found in workflow ${WORKFLOW_NAME}`)
      await groupNode.copy()
    })

    test('@perf Copies and pastes group node within the same workflow', async ({
      comfyPage
    }) => {
      const perfMonitor = new PerformanceMonitor(comfyPage.page)
      const testName = 'copy-paste-group-node-same-workflow'

      await perfMonitor.startMonitoring(testName)

      await perfMonitor.measureOperation('paste-group-node', async () => {
        await comfyPage.ctrlV()
      })

      await verifyNodeLoaded(comfyPage, 2)

      await perfMonitor.finishMonitoring(testName)
    })

    test('@perf Copies and pastes group node after clearing workflow', async ({
      comfyPage
    }) => {
      const perfMonitor = new PerformanceMonitor(comfyPage.page)
      const testName = 'copy-paste-group-node-after-clear'

      await perfMonitor.startMonitoring(testName)

      await perfMonitor.measureOperation('clear-workflow', async () => {
        await comfyPage.menu.topbar.triggerTopbarCommand([
          'Edit',
          'Clear Workflow'
        ])
      })

      await perfMonitor.measureOperation('paste-group-node', async () => {
        await comfyPage.ctrlV()
      })

      await verifyNodeLoaded(comfyPage, 1)

      await perfMonitor.finishMonitoring(testName)
    })

    test('@perf Copies and pastes group node into a newly created blank workflow', async ({
      comfyPage
    }) => {
      const perfMonitor = new PerformanceMonitor(comfyPage.page)
      const testName = 'copy-paste-group-node-new-workflow'

      await perfMonitor.startMonitoring(testName)

      await perfMonitor.measureOperation('create-new-workflow', async () => {
        await comfyPage.menu.topbar.triggerTopbarCommand(['Workflow', 'New'])
      })

      await perfMonitor.measureOperation('paste-group-node', async () => {
        await comfyPage.ctrlV()
      })

      await verifyNodeLoaded(comfyPage, 1)

      await perfMonitor.finishMonitoring(testName)
    })

    test('@perf Copies and pastes group node across different workflows', async ({
      comfyPage
    }) => {
      const perfMonitor = new PerformanceMonitor(comfyPage.page)
      const testName = 'copy-paste-group-node-different-workflow'

      await perfMonitor.startMonitoring(testName)

      await perfMonitor.measureOperation(
        'load-different-workflow',
        async () => {
          await comfyPage.loadWorkflow('default')
        }
      )

      await perfMonitor.measureOperation('paste-group-node', async () => {
        await comfyPage.ctrlV()
      })

      await verifyNodeLoaded(comfyPage, 1)

      await perfMonitor.finishMonitoring(testName)
    })

    test('@perf Serializes group node after copy and paste across workflows', async ({
      comfyPage
    }) => {
      const perfMonitor = new PerformanceMonitor(comfyPage.page)
      const testName = 'serialize-group-node-cross-workflow'

      await perfMonitor.startMonitoring(testName)

      await perfMonitor.measureOperation('create-new-workflow', async () => {
        await comfyPage.menu.topbar.triggerTopbarCommand(['Workflow', 'New'])
      })

      await perfMonitor.measureOperation('paste-group-node', async () => {
        await comfyPage.ctrlV()
      })

      let currentGraphState
      await perfMonitor.measureOperation('serialize-graph', async () => {
        currentGraphState = await comfyPage.page.evaluate(() =>
          window['app'].graph.serialize()
        )
      })

      await test.step('Load workflow containing a group node pasted from a different workflow', async () => {
        await perfMonitor.measureOperation(
          'load-serialized-workflow',
          async () => {
            await comfyPage.page.evaluate(
              (workflow) => window['app'].loadGraphData(workflow),
              currentGraphState
            )
            await comfyPage.nextFrame()
          }
        )

        await verifyNodeLoaded(comfyPage, 1)
      })

      await perfMonitor.finishMonitoring(testName)
    })
  })

  test.describe('Keybindings', () => {
    test('Convert to group node, no selection', async ({ comfyPage }) => {
      expect(await comfyPage.getVisibleToastCount()).toBe(0)
      await comfyPage.page.keyboard.press('Alt+g')
      await comfyPage.page.waitForTimeout(300)
      expect(await comfyPage.getVisibleToastCount()).toBe(1)
    })
    test('@perf Convert to group node, selected 1 node', async ({
      comfyPage
    }) => {
      const perfMonitor = new PerformanceMonitor(comfyPage.page)
      const testName = 'convert-single-node-to-group-keybinding'

      await perfMonitor.startMonitoring(testName)

      expect(await comfyPage.getVisibleToastCount()).toBe(0)

      await perfMonitor.measureOperation('select-node', async () => {
        await comfyPage.clickTextEncodeNode1()
      })

      await perfMonitor.measureOperation(
        'trigger-group-keybinding',
        async () => {
          await comfyPage.page.keyboard.press('Alt+g')
          await comfyPage.page.waitForTimeout(300)
        }
      )

      expect(await comfyPage.getVisibleToastCount()).toBe(1)

      await perfMonitor.finishMonitoring(testName)
    })
  })
})
