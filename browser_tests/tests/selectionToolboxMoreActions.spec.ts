import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'

async function openMoreOptions(comfyPage: ComfyPage) {
  await expect(comfyPage.selectionToolbox).toBeVisible()

  const moreOptionsBtn = comfyPage.page.getByTestId('more-options-button')
  await expect(moreOptionsBtn).toBeVisible()
  await moreOptionsBtn.click()
  await comfyPage.nextFrame()

  // Wait for the context menu to appear by checking for 'Copy', which is
  // always present regardless of single or multi-node selection.
  const menu = comfyPage.page.locator('.p-contextmenu')
  await expect(menu.getByText('Copy', { exact: true })).toBeVisible()
}

test.describe('Selection Toolbox - More Options', { tag: '@ui' }, () => {
  test.describe('Single node actions', () => {
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

      await expect(nodeRef).not.toBePinned()

      await openMoreOptions(comfyPage)
      await comfyPage.page.getByText('Pin', { exact: true }).click()
      await comfyPage.nextFrame()

      await expect(nodeRef).toBePinned()

      await openMoreOptions(comfyPage)
      await comfyPage.page.getByText('Unpin', { exact: true }).click()
      await comfyPage.nextFrame()

      await expect(nodeRef).not.toBePinned()
    })

    test('minimize and expand node via More Options menu', async ({
      comfyPage
    }) => {
      const nodeRef = (
        await comfyPage.nodeOps.getNodeRefsByTitle('KSampler')
      )[0]
      await comfyPage.nodeOps.selectNodeWithPan(nodeRef)

      await expect(nodeRef).not.toBeCollapsed()

      await openMoreOptions(comfyPage)
      await comfyPage.page.getByText('Minimize Node', { exact: true }).click()
      await comfyPage.nextFrame()

      await expect(nodeRef).toBeCollapsed()

      await openMoreOptions(comfyPage)
      await comfyPage.page.getByText('Expand Node', { exact: true }).click()
      await comfyPage.nextFrame()

      await expect(nodeRef).not.toBeCollapsed()
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

    test('refresh button is rendered in toolbox when node is selected', async ({
      comfyPage
    }) => {
      const nodeRef = (
        await comfyPage.nodeOps.getNodeRefsByTitle('KSampler')
      )[0]
      await comfyPage.nodeOps.selectNodeWithPan(nodeRef)

      await expect(comfyPage.selectionToolbox).toBeVisible()

      // The refresh button uses v-show so it's always in the DOM;
      // actual visibility depends on backend-provided widget refresh
      // capabilities which vary between local and CI environments.
      const refreshButton = comfyPage.page.getByTestId('refresh-button')
      await expect(refreshButton).toBeAttached()
    })
  })

  test.describe('Multiple node actions', () => {
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

      await expect(ksampler).not.toBeBypassed()
      await expect(emptyLatent).not.toBeBypassed()

      const bypassButton = comfyPage.page.getByTestId('bypass-button')
      await expect(bypassButton).toBeVisible()
      await bypassButton.click()
      await comfyPage.nextFrame()

      await expect(ksampler).toBeBypassed()
      await expect(emptyLatent).toBeBypassed()

      // Toggle back
      await bypassButton.click()
      await comfyPage.nextFrame()

      await expect(ksampler).not.toBeBypassed()
      await expect(emptyLatent).not.toBeBypassed()
    })
  })
})
