import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../../fixtures/ComfyPage'
import { PropertiesPanelHelper } from '../../helpers/PropertiesPanelHelper'

test.describe('Properties panel', () => {
  let panel: PropertiesPanelHelper

  test.beforeEach(async ({ comfyPage }) => {
    panel = new PropertiesPanelHelper(comfyPage.page)
  })

  test.describe('Open and close', () => {
    test('should open via actionbar toggle button', async ({ comfyPage }) => {
      await expect(panel.root).not.toBeVisible()
      await comfyPage.actionbar.propertiesButton.click()
      await expect(panel.root).toBeVisible()
    })

    test('should close via panel close button', async ({ comfyPage }) => {
      await comfyPage.actionbar.propertiesButton.click()
      await expect(panel.root).toBeVisible()
      await panel.closeButton.click()
      await expect(panel.root).not.toBeVisible()
    })

    test('should close via close button after opening', async ({
      comfyPage
    }) => {
      await comfyPage.actionbar.propertiesButton.click()
      await expect(panel.root).toBeVisible()
      await panel.close()
      await expect(panel.root).not.toBeVisible()
    })
  })

  test.describe('Workflow Overview (no selection)', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.actionbar.propertiesButton.click()
      await expect(panel.root).toBeVisible()
    })

    test('should show "Workflow Overview" title when nothing is selected', async () => {
      await expect(panel.panelTitle).toContainText('Workflow Overview')
    })

    test('should show Parameters, Nodes, and Settings tabs', async () => {
      await expect(panel.getTab('Parameters')).toBeVisible()
      await expect(panel.getTab('Nodes')).toBeVisible()
      await expect(panel.getTab('Settings')).toBeVisible()
    })

    test('should not show Info tab when nothing is selected', async () => {
      await expect(panel.getTab('Info')).not.toBeVisible()
    })

    test('should switch to Nodes tab and list all workflow nodes', async ({
      comfyPage
    }) => {
      await panel.switchToTab('Nodes')
      // Default workflow has multiple nodes
      const nodeCount = await comfyPage.nodeOps.getNodeCount()
      expect(nodeCount).toBeGreaterThan(0)
      // The Nodes tab should show at least one node entry
      await expect(panel.contentArea.locator('text=KSampler')).toBeVisible()
    })

    test('should switch to Settings tab and show global settings', async () => {
      await panel.switchToTab('Settings')
      await expect(panel.viewAllSettingsButton).toBeVisible()
    })
  })

  test.describe('Single node selection', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.actionbar.propertiesButton.click()
      await comfyPage.nodeOps.selectNodes(['KSampler'])
    })

    test('should show node title in panel header', async () => {
      await expect(panel.panelTitle).toContainText('KSampler')
    })

    test('should show Parameters, Info, and Settings tabs', async () => {
      await expect(panel.getTab('Parameters')).toBeVisible()
      await expect(panel.getTab('Info')).toBeVisible()
      await expect(panel.getTab('Settings')).toBeVisible()
    })

    test('should not show Nodes tab for single node', async () => {
      await expect(panel.getTab('Nodes')).not.toBeVisible()
    })

    test('should display node widgets in Parameters tab', async () => {
      // KSampler has widgets like seed, steps, cfg, sampler_name, scheduler, denoise
      await expect(panel.contentArea.getByText('seed')).toBeVisible()
      await expect(panel.contentArea.getByText('steps')).toBeVisible()
    })
  })

  test.describe('Multi-node selection', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.actionbar.propertiesButton.click()
    })

    test('should show item count in title', async ({ comfyPage }) => {
      await comfyPage.nodeOps.selectNodes([
        'KSampler',
        'CLIP Text Encode (Prompt)'
      ])

      await expect(panel.panelTitle).toContainText('items selected')
    })

    test('should list all selected nodes in Parameters tab', async ({
      comfyPage
    }) => {
      await comfyPage.nodeOps.selectNodes([
        'KSampler',
        'CLIP Text Encode (Prompt)'
      ])

      await expect(panel.root.getByText('KSampler')).toHaveCount(1)
      await expect(
        panel.root.getByText('CLIP Text Encode (Prompt)')
      ).toHaveCount(2)
    })

    test('should not show Info tab for multi-selection', async ({
      comfyPage
    }) => {
      await comfyPage.nodeOps.selectNodes([
        'KSampler',
        'CLIP Text Encode (Prompt)'
      ])

      await expect(panel.getTab('Info')).not.toBeVisible()
    })
  })

  test.describe('Title editing', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.actionbar.propertiesButton.click()
      await comfyPage.nodeOps.selectNodes(['KSampler'])
    })

    test('should show pencil icon for editable title', async () => {
      await expect(panel.titleEditIcon).toBeVisible()
    })

    test('should enter edit mode on pencil click', async () => {
      await panel.titleEditIcon.click()
      await expect(panel.titleInput).toBeVisible()
    })

    test('should update node title on edit', async () => {
      const newTitle = 'My Custom Sampler'
      await panel.editTitle(newTitle)
      await expect(panel.panelTitle).toContainText(newTitle)
    })

    test('should not show pencil icon for multi-selection', async ({
      comfyPage
    }) => {
      await comfyPage.nodeOps.selectNodes([
        'KSampler',
        'CLIP Text Encode (Prompt)'
      ])
      await expect(panel.titleEditIcon).not.toBeVisible()
    })

    test('should not show pencil icon when nothing is selected', async ({
      comfyPage
    }) => {
      // Clear selection via evaluate to avoid workflow-tab overlay
      await comfyPage.page.evaluate(() => {
        window.app!.graph.deselectAll()
      })
      await comfyPage.nextFrame()
      await expect(panel.panelTitle).toContainText('Workflow Overview')
      await expect(panel.titleEditIcon).not.toBeVisible()
    })
  })

  test.describe('Search filtering', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.actionbar.propertiesButton.click()
      await comfyPage.nodeOps.selectNodes([
        'KSampler',
        'CLIP Text Encode (Prompt)'
      ])
    })

    test('should filter nodes by search query', async () => {
      await panel.searchWidgets('seed')
      await expect(panel.root.getByText('KSampler')).toHaveCount(1)
      await expect(
        panel.root.getByText('CLIP Text Encode (Prompt)')
      ).toHaveCount(0)
    })

    test('should restore all nodes when search is cleared', async () => {
      await panel.searchWidgets('seed')
      await panel.clearSearch()
      await expect(panel.root.getByText('KSampler')).toHaveCount(1)
      await expect(
        panel.root.getByText('CLIP Text Encode (Prompt)')
      ).toHaveCount(2)
    })

    test('should show empty state for no matches', async () => {
      await panel.searchWidgets('nonexistent_widget_xyz')
      await expect(
        panel.contentArea.getByText(/no .* match|no results|no items/i)
      ).toBeVisible()
    })
  })

  test.describe('Settings tab - Node state', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.actionbar.propertiesButton.click()
      await comfyPage.nodeOps.selectNodes(['KSampler'])
      await panel.switchToTab('Settings')
    })

    test('should show Normal, Bypass, and Mute state buttons', async () => {
      await expect(panel.getNodeStateButton('Normal')).toBeVisible()
      await expect(panel.getNodeStateButton('Bypass')).toBeVisible()
      await expect(panel.getNodeStateButton('Mute')).toBeVisible()
    })

    test('should set node to Bypass mode', async ({ comfyPage }) => {
      await panel.getNodeStateButton('Bypass').click()

      const mode = await comfyPage.page.evaluate(() => {
        const node = window.app!.graph.nodes.find(
          (n: { type: string }) => n.type === 'KSampler'
        )
        return node?.mode
      })
      // LGraphEventMode.BYPASS = 4
      expect(mode).toBe(4)
    })

    test('should set node to Mute mode', async ({ comfyPage }) => {
      await panel.getNodeStateButton('Mute').click()

      const mode = await comfyPage.page.evaluate(() => {
        const node = window.app!.graph.nodes.find(
          (n: { type: string }) => n.type === 'KSampler'
        )
        return node?.mode
      })
      // LGraphEventMode.NEVER = 2
      expect(mode).toBe(2)
    })

    test('should restore node to Normal mode', async ({ comfyPage }) => {
      await panel.getNodeStateButton('Bypass').click()
      await panel.getNodeStateButton('Normal').click()

      const mode = await comfyPage.page.evaluate(() => {
        const node = window.app!.graph.nodes.find(
          (n: { type: string }) => n.type === 'KSampler'
        )
        return node?.mode
      })
      // LGraphEventMode.ALWAYS = 0
      expect(mode).toBe(0)
    })
  })

  test.describe('Settings tab - Node color', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.actionbar.propertiesButton.click()
      await comfyPage.nodeOps.selectNodes(['KSampler'])
      await panel.switchToTab('Settings')
    })

    test('should display color swatches', async () => {
      await expect(panel.getColorSwatch('noColor')).toBeVisible()
      await expect(panel.getColorSwatch('red')).toBeVisible()
      await expect(panel.getColorSwatch('blue')).toBeVisible()
    })

    test('should apply color to node', async ({ comfyPage }) => {
      await panel.getColorSwatch('red').click()

      const colorOption = await comfyPage.page.evaluate(() => {
        const node = window.app!.graph.nodes.find(
          (n: { type: string }) => n.type === 'KSampler'
        )
        return node?.getColorOption()
      })
      expect(colorOption).not.toBeNull()
      expect(colorOption?.bgcolor).toBeTruthy()
    })

    test('should remove color with noColor swatch', async ({ comfyPage }) => {
      // First set a color
      await panel.getColorSwatch('red').click()
      // Then remove it
      await panel.getColorSwatch('noColor').click()

      const colorOption = await comfyPage.page.evaluate(() => {
        const node = window.app!.graph.nodes.find(
          (n: { type: string }) => n.type === 'KSampler'
        )
        return node?.getColorOption()
      })
      expect(colorOption).toBeNull()
    })
  })

  test.describe('Settings tab - Pinned state', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.actionbar.propertiesButton.click()
      await comfyPage.nodeOps.selectNodes(['KSampler'])
      await panel.switchToTab('Settings')
    })

    test('should display pinned toggle', async () => {
      await expect(panel.pinnedSwitch).toBeVisible()
    })

    test('should toggle pinned state', async ({ comfyPage }) => {
      await panel.pinnedSwitch.click()

      const isPinned = await comfyPage.page.evaluate(() => {
        const node = window.app!.graph.nodes.find(
          (n: { type: string }) => n.type === 'KSampler'
        )
        return node?.pinned
      })
      expect(isPinned).toBe(true)
    })

    test('should unpin previously pinned node', async ({ comfyPage }) => {
      // Pin
      await panel.pinnedSwitch.click()
      // Unpin
      await panel.pinnedSwitch.click()

      const isPinned = await comfyPage.page.evaluate(() => {
        const node = window.app!.graph.nodes.find(
          (n: { type: string }) => n.type === 'KSampler'
        )
        return node?.pinned
      })
      expect(isPinned).toBe(false)
    })
  })

  test.describe('Info tab', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.actionbar.propertiesButton.click()
      await comfyPage.nodeOps.selectNodes(['KSampler'])
      await panel.switchToTab('Info')
    })

    test('should show node help content', async () => {
      // Info tab shows NodeHelpContent which should display the node info
      await expect(panel.contentArea).toBeVisible()
      // NodeHelpContent renders headings like "Inputs"
      await expect(
        panel.contentArea.getByRole('heading', { name: 'Inputs' })
      ).toBeVisible()
    })
  })

  test.describe('Global Settings tab (no selection)', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.actionbar.propertiesButton.click()
      await panel.switchToTab('Settings')
    })

    test('should show "View all settings" button', async () => {
      await expect(panel.viewAllSettingsButton).toBeVisible()
    })

    test('should show Nodes section with toggles', async () => {
      await expect(
        panel.contentArea.getByRole('button', { name: 'NODES' })
      ).toBeVisible()
    })

    test('should show Canvas section with grid settings', async () => {
      await expect(panel.contentArea.getByText('Canvas')).toBeVisible()
    })

    test('should show Connection Links section', async () => {
      await expect(
        panel.contentArea.getByText('Connection Links')
      ).toBeVisible()
    })
  })

  test.describe('Selection changes update panel', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.actionbar.propertiesButton.click()
    })

    test('should update from no selection to node selection', async ({
      comfyPage
    }) => {
      await expect(panel.panelTitle).toContainText('Workflow Overview')
      await comfyPage.nodeOps.selectNodes(['KSampler'])
      await expect(panel.panelTitle).toContainText('KSampler')
    })

    test('should update from node selection back to no selection', async ({
      comfyPage
    }) => {
      await comfyPage.nodeOps.selectNodes(['KSampler'])
      await expect(panel.panelTitle).toContainText('KSampler')
      // Clear selection via evaluate to avoid workflow-tab overlay
      await comfyPage.page.evaluate(() => {
        window.app!.graph.deselectAll()
      })
      await comfyPage.nextFrame()
      await expect(panel.panelTitle).toContainText('Workflow Overview')
    })

    test('should update between different single node selections', async ({
      comfyPage
    }) => {
      await comfyPage.nodeOps.selectNodes(['KSampler'])
      await expect(panel.panelTitle).toContainText('KSampler')

      // Clear selection via evaluate to avoid workflow-tab overlay
      await comfyPage.page.evaluate(() => {
        window.app!.graph.deselectAll()
      })
      await comfyPage.nextFrame()
      await comfyPage.nodeOps.selectNodes(['CLIP Text Encode (Prompt)'])
      await expect(panel.panelTitle).toContainText('CLIP Text Encode (Prompt)')
    })
  })

  test.describe('Nodes tab (no selection)', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.actionbar.propertiesButton.click()
      await panel.switchToTab('Nodes')
    })

    test('should list all nodes in the workflow', async ({ comfyPage }) => {
      const nodeCount = await comfyPage.nodeOps.getNodeCount()
      expect(nodeCount).toBeGreaterThan(0)

      // Verify key nodes from default workflow appear
      await expect(
        panel.contentArea.getByText('KSampler').first()
      ).toBeVisible()
    })

    test('should filter nodes by search in Nodes tab', async () => {
      await panel.searchWidgets('KSampler')
      await expect(
        panel.contentArea.getByText('KSampler').first()
      ).toBeVisible()
    })
  })

  test.describe('Tab label changes based on selection count', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.actionbar.propertiesButton.click()
    })

    test('should show "Parameters" tab for single node', async ({
      comfyPage
    }) => {
      await comfyPage.nodeOps.selectNodes(['KSampler'])
      await expect(panel.getTab('Parameters')).toBeVisible()
    })

    test('should show "Nodes" tab label for multi-selection', async ({
      comfyPage
    }) => {
      await comfyPage.nodeOps.selectNodes([
        'KSampler',
        'CLIP Text Encode (Prompt)'
      ])
      // When multiple items selected, the tab label changes from "Parameters" to "Nodes"
      await expect(panel.getTab('Nodes')).toBeVisible()
    })
  })

  test.describe('Errors tab', () => {
    test('should show Errors tab when errors exist', async ({ comfyPage }) => {
      // Enable the errors tab setting
      await comfyPage.settings.setSetting(
        'Comfy.RightSidePanel.ShowErrorsTab',
        true
      )
      // Load a workflow with missing nodes to trigger errors
      await comfyPage.workflow.loadWorkflow('missing/missing_nodes')
      await comfyPage.actionbar.propertiesButton.click()
      await comfyPage.nextFrame()

      await expect(panel.errorsTabIcon).toBeVisible()
    })

    test('should not show Errors tab when errors are disabled', async ({
      comfyPage
    }) => {
      await comfyPage.actionbar.propertiesButton.click()
      // The default fixture disables the errors tab
      await expect(panel.errorsTabIcon).not.toBeVisible()
    })
  })
})
