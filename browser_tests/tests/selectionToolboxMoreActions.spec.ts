import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'

// force: true is needed because the canvas overlay (z-999) intercepts pointer events
async function openMoreOptions(comfyPage: ComfyPage) {
  await expect(comfyPage.page.locator('.selection-toolbox')).toBeVisible()

  const moreOptionsBtn = comfyPage.page.getByTestId('more-options-button')
  await expect(moreOptionsBtn).toBeVisible()
  await moreOptionsBtn.click({ force: true })
  await comfyPage.nextFrame()

  // Wait for the context menu to appear by checking for 'Copy', which is
  // always present regardless of single or multi-node selection.
  const menu = comfyPage.page.locator('.p-popover')
  await expect(menu.getByText('Copy', { exact: true })).toBeVisible()
}

test.beforeEach(async ({ comfyPage }) => {
  // 'Top' is required for the selection toolbox actions to render in
  // the new menu bar; sibling specs that only test canvas-level toolbox
  // visibility use 'Disabled'.
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
      await comfyPage.nodeOps.selectNodeWithPan(nodeRef)

      expect(await nodeRef.isPinned(), 'Node should start unpinned').toBe(false)

      await openMoreOptions(comfyPage)
      await comfyPage.page.getByText('Pin', { exact: true }).click()
      await comfyPage.nextFrame()

      await expect.poll(() => nodeRef.isPinned()).toBe(true)

      await openMoreOptions(comfyPage)
      await comfyPage.page.getByText('Unpin', { exact: true }).click()
      await comfyPage.nextFrame()

      await expect.poll(() => nodeRef.isPinned()).toBe(false)
    })

    test('minimize and expand node via More Options menu', async ({
      comfyPage
    }) => {
      const nodeRef = (
        await comfyPage.nodeOps.getNodeRefsByTitle('KSampler')
      )[0]
      await comfyPage.nodeOps.selectNodeWithPan(nodeRef)

      expect(await nodeRef.isCollapsed(), 'Node should start expanded').toBe(
        false
      )

      await openMoreOptions(comfyPage)
      await comfyPage.page.getByText('Minimize Node', { exact: true }).click()
      await comfyPage.nextFrame()

      await expect.poll(() => nodeRef.isCollapsed()).toBe(true)

      await openMoreOptions(comfyPage)
      await comfyPage.page.getByText('Expand Node', { exact: true }).click()
      await comfyPage.nextFrame()

      await expect.poll(() => nodeRef.isCollapsed()).toBe(false)
    })

    test('copy via More Options menu', async ({ comfyPage }) => {
      const nodeRef = (
        await comfyPage.nodeOps.getNodeRefsByTitle('KSampler')
      )[0]
      await comfyPage.nodeOps.selectNodeWithPan(nodeRef)

      const initialCount = await comfyPage.nodeOps.getGraphNodesCount()

      await openMoreOptions(comfyPage)
      await comfyPage.page.getByText('Copy', { exact: true }).click()
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
      await comfyPage.nodeOps.selectNodeWithPan(nodeRef)

      const initialCount = await comfyPage.nodeOps.getGraphNodesCount()

      await openMoreOptions(comfyPage)
      await comfyPage.page.getByText('Duplicate', { exact: true }).click()
      await comfyPage.nextFrame()

      await expect
        .poll(() => comfyPage.nodeOps.getGraphNodesCount())
        .toBe(initialCount + 1)
    })

    test('refresh button is visible for node with refreshable widgets', async ({
      comfyPage
    }) => {
      const nodeRef = (
        await comfyPage.nodeOps.getNodeRefsByTitle('KSampler')
      )[0]
      await comfyPage.nodeOps.selectNodeWithPan(nodeRef)

      await expect(comfyPage.page.locator('.selection-toolbox')).toBeVisible()

      // KSampler has combo widgets with a refresh method, so the
      // refresh button should always be visible for this node.
      const refreshButton = comfyPage.page.getByTestId('refresh-button')
      await expect(refreshButton).toBeVisible()
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

      expect(
        await ksampler.isBypassed(),
        'KSampler should start not bypassed'
      ).toBe(false)
      expect(
        await emptyLatent.isBypassed(),
        'Empty Latent should start not bypassed'
      ).toBe(false)

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
