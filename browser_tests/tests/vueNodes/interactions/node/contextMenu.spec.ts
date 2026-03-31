import type { Locator } from '@playwright/test'

import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '../../../../fixtures/ComfyPage'
import type { ComfyPage } from '../../../../fixtures/ComfyPage'

const BYPASS_CLASS = /before:bg-bypass\/60/
const PIN_INDICATOR = '[data-testid="node-pin-indicator"]'

async function clickExactMenuItem(comfyPage: ComfyPage, name: string) {
  await comfyPage.page.getByRole('menuitem', { name, exact: true }).click()
  await comfyPage.nextFrame()
}

async function openContextMenu(comfyPage: ComfyPage, nodeTitle: string) {
  const header = comfyPage.vueNodes
    .getNodeByTitle(nodeTitle)
    .locator('.lg-node-header')
  await header.click()
  await header.click({ button: 'right' })
  const menu = comfyPage.page.locator('.p-contextmenu')
  await menu.waitFor({ state: 'visible' })
  return menu
}

async function openMultiNodeContextMenu(
  comfyPage: ComfyPage,
  titles: string[]
) {
  // deselectAll via evaluate — clearSelection() clicks at a fixed position
  // which can hit nodes or the toolbar overlay
  await comfyPage.page.evaluate(() => window.app!.canvas.deselectAll())
  await comfyPage.nextFrame()

  for (const title of titles) {
    const header = comfyPage.vueNodes
      .getNodeByTitle(title)
      .locator('.lg-node-header')
    await header.click({ modifiers: ['ControlOrMeta'] })
  }
  await comfyPage.nextFrame()

  const firstHeader = comfyPage.vueNodes
    .getNodeByTitle(titles[0])
    .locator('.lg-node-header')
  const box = await firstHeader.boundingBox()
  if (!box) throw new Error(`Header for "${titles[0]}" not found`)
  await comfyPage.page.mouse.click(
    box.x + box.width / 2,
    box.y + box.height / 2,
    { button: 'right' }
  )

  const menu = comfyPage.page.locator('.p-contextmenu')
  await menu.waitFor({ state: 'visible' })
  return menu
}

function getNodeWrapper(comfyPage: ComfyPage, nodeTitle: string): Locator {
  return comfyPage.page
    .locator('[data-node-id]')
    .filter({ hasText: nodeTitle })
    .getByTestId('node-inner-wrapper')
}

async function getNodeRef(comfyPage: ComfyPage, nodeTitle: string) {
  const refs = await comfyPage.nodeOps.getNodeRefsByTitle(nodeTitle)
  return refs[0]
}

test.describe('Vue Node Context Menu', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
    await comfyPage.vueNodes.waitForNodes()
  })

  test.describe('Single Node Actions', () => {
    test('should rename node via context menu', async ({ comfyPage }) => {
      await openContextMenu(comfyPage, 'KSampler')
      await clickExactMenuItem(comfyPage, 'Rename')

      const titleInput = comfyPage.page.locator(
        '.node-title-editor input[type="text"]'
      )
      await titleInput.waitFor({ state: 'visible' })
      await titleInput.fill('My Renamed Sampler')
      await titleInput.press('Enter')
      await comfyPage.nextFrame()

      const renamedNode =
        comfyPage.vueNodes.getNodeByTitle('My Renamed Sampler')
      await expect(renamedNode).toBeVisible()
    })

    test('should copy and paste node via context menu', async ({
      comfyPage
    }) => {
      const initialCount = await comfyPage.nodeOps.getGraphNodesCount()

      await openContextMenu(comfyPage, 'Load Checkpoint')
      await clickExactMenuItem(comfyPage, 'Copy')

      // Internal clipboard paste (menu Copy uses canvas clipboard, not OS)
      await comfyPage.page.evaluate(() => {
        window.app!.canvas.pasteFromClipboard({ connectInputs: false })
      })
      await comfyPage.nextFrame()

      expect(await comfyPage.nodeOps.getGraphNodesCount()).toBe(
        initialCount + 1
      )
    })

    test('should duplicate node via context menu', async ({ comfyPage }) => {
      const initialCount = await comfyPage.nodeOps.getGraphNodesCount()

      await openContextMenu(comfyPage, 'Load Checkpoint')
      await clickExactMenuItem(comfyPage, 'Duplicate')

      expect(await comfyPage.nodeOps.getGraphNodesCount()).toBe(
        initialCount + 1
      )
    })

    test('should pin and unpin node via context menu', async ({
      comfyPage
    }) => {
      const nodeTitle = 'Load Checkpoint'
      const nodeRef = await getNodeRef(comfyPage, nodeTitle)

      // Pin via context menu
      await openContextMenu(comfyPage, nodeTitle)
      await clickExactMenuItem(comfyPage, 'Pin')

      const pinIndicator = comfyPage.vueNodes
        .getNodeByTitle(nodeTitle)
        .locator(PIN_INDICATOR)
      await expect(pinIndicator).toBeVisible()
      expect(await nodeRef.isPinned()).toBe(true)

      // Verify drag blocked
      const header = comfyPage.vueNodes
        .getNodeByTitle(nodeTitle)
        .locator('.lg-node-header')
      const posBeforeDrag = await header.boundingBox()
      if (!posBeforeDrag) throw new Error('Header not found')
      await comfyPage.canvasOps.dragAndDrop(
        { x: posBeforeDrag.x + 10, y: posBeforeDrag.y + 10 },
        { x: posBeforeDrag.x + 256, y: posBeforeDrag.y + 256 }
      )
      const posAfterDrag = await header.boundingBox()
      expect(posAfterDrag).toEqual(posBeforeDrag)

      // Unpin via context menu
      await openContextMenu(comfyPage, nodeTitle)
      await clickExactMenuItem(comfyPage, 'Unpin')

      await expect(pinIndicator).not.toBeVisible()
      expect(await nodeRef.isPinned()).toBe(false)
    })

    test('should bypass node and remove bypass via context menu', async ({
      comfyPage
    }) => {
      const nodeTitle = 'Load Checkpoint'
      const nodeRef = await getNodeRef(comfyPage, nodeTitle)

      await openContextMenu(comfyPage, nodeTitle)
      await clickExactMenuItem(comfyPage, 'Bypass')

      expect(await nodeRef.isBypassed()).toBe(true)
      await expect(getNodeWrapper(comfyPage, nodeTitle)).toHaveClass(
        BYPASS_CLASS
      )

      await openContextMenu(comfyPage, nodeTitle)
      await clickExactMenuItem(comfyPage, 'Remove Bypass')

      expect(await nodeRef.isBypassed()).toBe(false)
      await expect(getNodeWrapper(comfyPage, nodeTitle)).not.toHaveClass(
        BYPASS_CLASS
      )
    })

    test('should minimize and expand node via context menu', async ({
      comfyPage
    }) => {
      const fixture = await comfyPage.vueNodes.getFixtureByTitle('KSampler')
      await expect(fixture.body).toBeVisible()

      await openContextMenu(comfyPage, 'KSampler')
      await clickExactMenuItem(comfyPage, 'Minimize Node')
      await expect(fixture.body).not.toBeVisible()

      await openContextMenu(comfyPage, 'KSampler')
      await clickExactMenuItem(comfyPage, 'Expand Node')
      await expect(fixture.body).toBeVisible()
    })

    test('should convert node to subgraph via context menu', async ({
      comfyPage
    }) => {
      await openContextMenu(comfyPage, 'KSampler')
      await clickExactMenuItem(comfyPage, 'Convert to Subgraph')

      const subgraphNode = comfyPage.vueNodes.getNodeByTitle('New Subgraph')
      await expect(subgraphNode).toBeVisible()

      await expect(
        comfyPage.vueNodes.getNodeByTitle('KSampler')
      ).not.toBeVisible()
    })
  })

  test.describe('Image Node Actions', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.page
        .context()
        .grantPermissions(['clipboard-read', 'clipboard-write'])
      await comfyPage.workflow.loadWorkflow('widgets/load_image_widget')
      await comfyPage.vueNodes.waitForNodes(1)
    })

    test('should copy image to clipboard via context menu', async ({
      comfyPage
    }) => {
      await openContextMenu(comfyPage, 'Load Image')
      await clickExactMenuItem(comfyPage, 'Copy Image')

      // Verify the clipboard contains an image
      const hasImage = await comfyPage.page.evaluate(async () => {
        const items = await navigator.clipboard.read()
        return items.some((item) =>
          item.types.some((t) => t.startsWith('image/'))
        )
      })
      expect(hasImage).toBe(true)
    })

    test('should paste image to LoadImage node via context menu', async ({
      comfyPage
    }) => {
      // Capture the original image src from the node's preview
      const imagePreview = comfyPage.page.locator('.image-preview img')
      const originalSrc = await imagePreview.getAttribute('src')

      // Write a test image into the browser clipboard
      await comfyPage.page.evaluate(async () => {
        const resp = await fetch('/api/view?filename=example.png&type=input')
        const blob = await resp.blob()
        await navigator.clipboard.write([
          new ClipboardItem({ [blob.type]: blob })
        ])
      })

      // Right-click and select Paste Image
      await openContextMenu(comfyPage, 'Load Image')
      await clickExactMenuItem(comfyPage, 'Paste Image')

      // Verify the image preview src changed
      await expect(imagePreview).not.toHaveAttribute('src', originalSrc!)
    })

    test('should open image in new tab via context menu', async ({
      comfyPage
    }) => {
      await openContextMenu(comfyPage, 'Load Image')

      const popupPromise = comfyPage.page.waitForEvent('popup')
      await clickExactMenuItem(comfyPage, 'Open Image')
      const popup = await popupPromise

      expect(popup.url()).toContain('/api/view')
      expect(popup.url()).toContain('filename=')
      await popup.close()
    })

    test('should download image via Save Image context menu', async ({
      comfyPage
    }) => {
      await openContextMenu(comfyPage, 'Load Image')

      const downloadPromise = comfyPage.page.waitForEvent('download')
      await clickExactMenuItem(comfyPage, 'Save Image')
      const download = await downloadPromise

      expect(download.suggestedFilename()).toBeTruthy()
    })
  })

  test.describe('Subgraph Actions', () => {
    test('should convert to subgraph and unpack back', async ({
      comfyPage
    }) => {
      // Convert KSampler to subgraph
      await openContextMenu(comfyPage, 'KSampler')
      await clickExactMenuItem(comfyPage, 'Convert to Subgraph')

      const subgraphNode = comfyPage.vueNodes.getNodeByTitle('New Subgraph')
      await expect(subgraphNode).toBeVisible()
      await expect(
        comfyPage.vueNodes.getNodeByTitle('KSampler')
      ).not.toBeVisible()

      // Unpack the subgraph
      await openContextMenu(comfyPage, 'New Subgraph')
      await clickExactMenuItem(comfyPage, 'Unpack Subgraph')

      await expect(comfyPage.vueNodes.getNodeByTitle('KSampler')).toBeVisible()
      await expect(
        comfyPage.vueNodes.getNodeByTitle('New Subgraph')
      ).not.toBeVisible()
    })

    test('should open properties panel via Edit Subgraph Widgets', async ({
      comfyPage
    }) => {
      // Convert to subgraph first
      await openContextMenu(comfyPage, 'Empty Latent Image')
      await clickExactMenuItem(comfyPage, 'Convert to Subgraph')
      await comfyPage.nextFrame()

      // Right-click subgraph and edit widgets
      await openContextMenu(comfyPage, 'New Subgraph')
      await clickExactMenuItem(comfyPage, 'Edit Subgraph Widgets')

      await expect(comfyPage.page.getByTestId('properties-panel')).toBeVisible()
    })

    test('should add subgraph to library and find in node library', async ({
      comfyPage
    }) => {
      // Convert to subgraph first
      await openContextMenu(comfyPage, 'KSampler')
      await clickExactMenuItem(comfyPage, 'Convert to Subgraph')
      await comfyPage.nextFrame()

      // Add to library
      await openContextMenu(comfyPage, 'New Subgraph')
      await clickExactMenuItem(comfyPage, 'Add Subgraph to Library')

      // Fill the blueprint name
      await comfyPage.nodeOps.promptDialogInput.waitFor({ state: 'visible' })
      await comfyPage.nodeOps.fillPromptDialog('TestBlueprint')

      // Open node library sidebar and search for the blueprint
      await comfyPage.page.getByRole('button', { name: 'Node Library' }).click()
      await comfyPage.nextFrame()
      const searchBox = comfyPage.page.getByRole('combobox', {
        name: 'Search'
      })
      await searchBox.waitFor({ state: 'visible' })
      await searchBox.fill('TestBlueprint')
      await comfyPage.nextFrame()

      await expect(comfyPage.page.getByText('TestBlueprint')).toBeVisible()
    })
  })

  test.describe('Multi-Node Actions', () => {
    const nodeTitles = ['Load Checkpoint', 'KSampler']

    test('should batch rename selected nodes via context menu', async ({
      comfyPage
    }) => {
      await openMultiNodeContextMenu(comfyPage, nodeTitles)
      await clickExactMenuItem(comfyPage, 'Rename')

      await comfyPage.nodeOps.promptDialogInput.waitFor({ state: 'visible' })
      await comfyPage.nodeOps.fillPromptDialog('MyNode')

      await expect(comfyPage.vueNodes.getNodeByTitle('MyNode 1')).toBeVisible()
      await expect(comfyPage.vueNodes.getNodeByTitle('MyNode 2')).toBeVisible()
    })

    test('should copy and paste selected nodes via context menu', async ({
      comfyPage
    }) => {
      const initialCount = await comfyPage.nodeOps.getGraphNodesCount()

      await openMultiNodeContextMenu(comfyPage, nodeTitles)
      await clickExactMenuItem(comfyPage, 'Copy')

      await comfyPage.page.evaluate(() => {
        window.app!.canvas.pasteFromClipboard({ connectInputs: false })
      })
      await comfyPage.nextFrame()

      expect(await comfyPage.nodeOps.getGraphNodesCount()).toBe(
        initialCount + nodeTitles.length
      )
    })

    test('should duplicate selected nodes via context menu', async ({
      comfyPage
    }) => {
      const initialCount = await comfyPage.nodeOps.getGraphNodesCount()

      await openMultiNodeContextMenu(comfyPage, nodeTitles)
      await clickExactMenuItem(comfyPage, 'Duplicate')

      expect(await comfyPage.nodeOps.getGraphNodesCount()).toBe(
        initialCount + nodeTitles.length
      )
    })

    test('should pin and unpin selected nodes via context menu', async ({
      comfyPage
    }) => {
      await openMultiNodeContextMenu(comfyPage, nodeTitles)
      await clickExactMenuItem(comfyPage, 'Pin')

      for (const title of nodeTitles) {
        const pinIndicator = comfyPage.vueNodes
          .getNodeByTitle(title)
          .locator(PIN_INDICATOR)
        await expect(pinIndicator).toBeVisible()
      }

      await openMultiNodeContextMenu(comfyPage, nodeTitles)
      await clickExactMenuItem(comfyPage, 'Unpin')

      for (const title of nodeTitles) {
        const pinIndicator = comfyPage.vueNodes
          .getNodeByTitle(title)
          .locator(PIN_INDICATOR)
        await expect(pinIndicator).not.toBeVisible()
      }
    })

    test('should bypass and remove bypass on selected nodes via context menu', async ({
      comfyPage
    }) => {
      await openMultiNodeContextMenu(comfyPage, nodeTitles)
      await clickExactMenuItem(comfyPage, 'Bypass')

      for (const title of nodeTitles) {
        const nodeRef = await getNodeRef(comfyPage, title)
        expect(await nodeRef.isBypassed()).toBe(true)
        await expect(getNodeWrapper(comfyPage, title)).toHaveClass(BYPASS_CLASS)
      }

      await openMultiNodeContextMenu(comfyPage, nodeTitles)
      await clickExactMenuItem(comfyPage, 'Remove Bypass')

      for (const title of nodeTitles) {
        const nodeRef = await getNodeRef(comfyPage, title)
        expect(await nodeRef.isBypassed()).toBe(false)
        await expect(getNodeWrapper(comfyPage, title)).not.toHaveClass(
          BYPASS_CLASS
        )
      }
    })

    test('should minimize and expand selected nodes via context menu', async ({
      comfyPage
    }) => {
      const fixture1 =
        await comfyPage.vueNodes.getFixtureByTitle('Load Checkpoint')
      const fixture2 = await comfyPage.vueNodes.getFixtureByTitle('KSampler')

      await expect(fixture1.body).toBeVisible()
      await expect(fixture2.body).toBeVisible()

      await openMultiNodeContextMenu(comfyPage, nodeTitles)
      await clickExactMenuItem(comfyPage, 'Minimize Node')

      await expect(fixture1.body).not.toBeVisible()
      await expect(fixture2.body).not.toBeVisible()

      await openMultiNodeContextMenu(comfyPage, nodeTitles)
      await clickExactMenuItem(comfyPage, 'Expand Node')

      await expect(fixture1.body).toBeVisible()
      await expect(fixture2.body).toBeVisible()
    })

    test('should frame selected nodes via context menu', async ({
      comfyPage
    }) => {
      const initialGroupCount = await comfyPage.page.evaluate(
        () => window.app!.graph.groups.length
      )

      await openMultiNodeContextMenu(comfyPage, nodeTitles)
      await clickExactMenuItem(comfyPage, 'Frame Nodes')

      const newGroupCount = await comfyPage.page.evaluate(
        () => window.app!.graph.groups.length
      )
      expect(newGroupCount).toBe(initialGroupCount + 1)
    })

    test('should convert to group node via context menu', async ({
      comfyPage
    }) => {
      await openMultiNodeContextMenu(comfyPage, nodeTitles)
      await clickExactMenuItem(comfyPage, 'Convert to Group Node')

      await comfyPage.nodeOps.promptDialogInput.waitFor({ state: 'visible' })
      await comfyPage.nodeOps.fillPromptDialog('TestGroupNode')

      const groupNodes = await comfyPage.nodeOps.getNodeRefsByType(
        'workflow>TestGroupNode'
      )
      expect(groupNodes.length).toBe(1)
    })

    test('should convert selected nodes to subgraph via context menu', async ({
      comfyPage
    }) => {
      const initialCount = await comfyPage.nodeOps.getGraphNodesCount()

      await openMultiNodeContextMenu(comfyPage, nodeTitles)
      await clickExactMenuItem(comfyPage, 'Convert to Subgraph')

      const subgraphNode = comfyPage.vueNodes.getNodeByTitle('New Subgraph')
      await expect(subgraphNode).toBeVisible()

      expect(await comfyPage.nodeOps.getGraphNodesCount()).toBe(
        initialCount - nodeTitles.length + 1
      )
    })
  })
})
