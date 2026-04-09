import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import type { NodeReference } from '@e2e/fixtures/utils/litegraphUtils'

async function panToNode(comfyPage: ComfyPage, nodeRef: NodeReference) {
  const nodePos = await nodeRef.getPosition()
  await comfyPage.page.evaluate((pos) => {
    const canvas = window.app!.canvas
    canvas.ds.offset[0] = -pos.x + canvas.canvas.width / 2
    canvas.ds.offset[1] = -pos.y + canvas.canvas.height / 2 + 100
    canvas.setDirty(true, true)
  }, nodePos)
  await comfyPage.nextFrame()
}

async function selectNodeWithPan(comfyPage: ComfyPage, nodeRef: NodeReference) {
  await panToNode(comfyPage, nodeRef)
  await nodeRef.click('title')
}

// force: true is needed because the canvas overlay (z-999) intercepts pointer events
async function openMoreOptions(comfyPage: ComfyPage) {
  await expect(comfyPage.page.locator('.selection-toolbox')).toBeVisible()

  const moreOptionsBtn = comfyPage.page.getByTestId('more-options-button')
  await expect(moreOptionsBtn).toBeVisible()
  await moreOptionsBtn.click({ force: true })
  await comfyPage.nextFrame()

  // Wait for the context menu to appear by checking for 'Copy', which is
  // always present regardless of single or multi-node selection.
  await expect(comfyPage.page.getByText('Copy', { exact: true })).toBeVisible()
}

test.beforeEach(async ({ comfyPage }) => {
  await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
})

test.describe(
  'Selection Toolbox - Pin, Collapse, Adjust Size',
  { tag: '@ui' },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.Canvas.SelectionToolbox', true)
      await comfyPage.workflow.loadWorkflow('nodes/single_ksampler')
      await comfyPage.nextFrame()
    })

    test('pin and unpin node via More Options menu', async ({ comfyPage }) => {
      const nodeRef = (
        await comfyPage.nodeOps.getNodeRefsByTitle('KSampler')
      )[0]
      await selectNodeWithPan(comfyPage, nodeRef)

      expect(await nodeRef.isPinned()).toBe(false)

      await openMoreOptions(comfyPage)
      await comfyPage.page
        .getByText('Pin', { exact: true })
        .click({ force: true })
      await comfyPage.nextFrame()

      await expect.poll(() => nodeRef.isPinned()).toBe(true)

      await openMoreOptions(comfyPage)
      await comfyPage.page
        .getByText('Unpin', { exact: true })
        .click({ force: true })
      await comfyPage.nextFrame()

      await expect.poll(() => nodeRef.isPinned()).toBe(false)
    })

    test('minimize and expand node via More Options menu', async ({
      comfyPage
    }) => {
      const nodeRef = (
        await comfyPage.nodeOps.getNodeRefsByTitle('KSampler')
      )[0]
      await selectNodeWithPan(comfyPage, nodeRef)

      expect(await nodeRef.isCollapsed()).toBe(false)

      await openMoreOptions(comfyPage)
      await comfyPage.page
        .getByText('Minimize Node', { exact: true })
        .click({ force: true })
      await comfyPage.nextFrame()

      await expect.poll(() => nodeRef.isCollapsed()).toBe(true)

      await openMoreOptions(comfyPage)
      await comfyPage.page
        .getByText('Expand Node', { exact: true })
        .click({ force: true })
      await comfyPage.nextFrame()

      await expect.poll(() => nodeRef.isCollapsed()).toBe(false)
    })

    test('copy via More Options menu', async ({ comfyPage }) => {
      const nodeRef = (
        await comfyPage.nodeOps.getNodeRefsByTitle('KSampler')
      )[0]
      await selectNodeWithPan(comfyPage, nodeRef)

      const initialCount = await comfyPage.nodeOps.getGraphNodesCount()

      await openMoreOptions(comfyPage)
      await comfyPage.page
        .getByText('Copy', { exact: true })
        .click({ force: true })
      await comfyPage.nextFrame()

      // Paste the copied node
      await comfyPage.clipboard.paste()
      await comfyPage.nextFrame()

      await expect
        .poll(() => comfyPage.nodeOps.getGraphNodesCount())
        .toBe(initialCount + 1)
    })

    test('duplicate via More Options menu', async ({ comfyPage }) => {
      const nodeRef = (
        await comfyPage.nodeOps.getNodeRefsByTitle('KSampler')
      )[0]
      await selectNodeWithPan(comfyPage, nodeRef)

      const initialCount = await comfyPage.nodeOps.getGraphNodesCount()

      await openMoreOptions(comfyPage)
      await comfyPage.page
        .getByText('Duplicate', { exact: true })
        .click({ force: true })
      await comfyPage.nextFrame()

      await expect
        .poll(() => comfyPage.nodeOps.getGraphNodesCount())
        .toBe(initialCount + 1)
    })

    test('refresh button visibility reflects node refreshable state', async ({
      comfyPage
    }) => {
      const nodeRef = (
        await comfyPage.nodeOps.getNodeRefsByTitle('KSampler')
      )[0]
      await selectNodeWithPan(comfyPage, nodeRef)

      // The toolbox should be visible after selecting a node
      await expect(comfyPage.page.locator('.selection-toolbox')).toBeVisible()

      // The refresh button uses v-show, so it exists in the DOM but is
      // only visible when the selected node has refreshable widgets.
      const refreshButton = comfyPage.page.getByTestId('refresh-button')
      await expect(refreshButton).toBeAttached()

      const hasRefreshableWidgets = await comfyPage.page.evaluate((nodeId) => {
        const node = window.app!.graph.getNodeById(nodeId)
        if (!node?.widgets) return false
        return node.widgets.some(
          (w: unknown) =>
            w != null &&
            typeof w === 'object' &&
            'refresh' in w &&
            typeof (w as { refresh: unknown }).refresh === 'function'
        )
      }, nodeRef.id)

      if (hasRefreshableWidgets) {
        await expect(refreshButton).toBeVisible()
      } else {
        await expect(refreshButton).not.toBeVisible()
      }
    })
  }
)

test.describe(
  'Selection Toolbox - Bypass with Multiple Nodes',
  { tag: '@ui' },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.Canvas.SelectionToolbox', true)
      await comfyPage.workflow.loadWorkflow('default')
      await comfyPage.nextFrame()
    })

    test('bypass button toggles bypass on multiple selected nodes', async ({
      comfyPage
    }) => {
      await comfyPage.nodeOps.selectNodes(['KSampler', 'Empty Latent Image'])
      await comfyPage.nextFrame()

      const ksampler = (
        await comfyPage.nodeOps.getNodeRefsByTitle('KSampler')
      )[0]
      const emptyLatent = (
        await comfyPage.nodeOps.getNodeRefsByTitle('Empty Latent Image')
      )[0]

      expect(await ksampler.isBypassed()).toBe(false)
      expect(await emptyLatent.isBypassed()).toBe(false)

      const bypassButton = comfyPage.page.getByTestId('bypass-button')
      await expect(bypassButton).toBeVisible()
      await bypassButton.click({ force: true })
      await comfyPage.nextFrame()

      await expect.poll(() => ksampler.isBypassed()).toBe(true)
      await expect.poll(() => emptyLatent.isBypassed()).toBe(true)

      // Toggle back
      await bypassButton.click({ force: true })
      await comfyPage.nextFrame()

      await expect.poll(() => ksampler.isBypassed()).toBe(false)
      await expect.poll(() => emptyLatent.isBypassed()).toBe(false)
    })
  }
)
