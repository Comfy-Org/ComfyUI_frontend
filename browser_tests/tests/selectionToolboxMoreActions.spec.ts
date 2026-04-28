import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { openMoreOptions } from '@e2e/fixtures/utils/selectionToolbox'

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

      let menu = await openMoreOptions(comfyPage)
      await menu.getByText('Pin', { exact: true }).click()
      await comfyPage.nextFrame()

      await expect(nodeRef).toBePinned()

      menu = await openMoreOptions(comfyPage)
      await menu.getByText('Unpin', { exact: true }).click()
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

      let menu = await openMoreOptions(comfyPage)
      await menu.getByText('Minimize Node', { exact: true }).click()
      await comfyPage.nextFrame()

      await expect(nodeRef).toBeCollapsed()

      menu = await openMoreOptions(comfyPage)
      await menu.getByText('Expand Node', { exact: true }).click()
      await comfyPage.nextFrame()

      await expect(nodeRef).not.toBeCollapsed()
    })

    test('copy via More Options menu', async ({ comfyPage }) => {
      const nodeRef = (
        await comfyPage.nodeOps.getNodeRefsByTitle('KSampler')
      )[0]
      await comfyPage.nodeOps.selectNodeWithPan(nodeRef)

      const initialCount = await comfyPage.nodeOps.getGraphNodesCount()

      const menu = await openMoreOptions(comfyPage)
      await menu.getByText('Copy', { exact: true }).click()
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

      const menu = await openMoreOptions(comfyPage)
      await menu.getByText('Duplicate', { exact: true }).click()
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
