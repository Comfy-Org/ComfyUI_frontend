import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { getGroupTitlePosition } from '@e2e/fixtures/utils/groupHelpers'
import { openMoreOptions } from '@e2e/fixtures/utils/selectionToolbox'

test.describe('Selection toolbox rename', { tag: '@ui' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.Canvas.SelectionToolbox', true)
    await comfyPage.workflow.loadWorkflow('default')
    await comfyPage.nextFrame()
  })

  test.describe('Single rename', () => {
    test('Rename via More Options opens title editor for single node', async ({
      comfyPage
    }) => {
      const nodeRef = (
        await comfyPage.nodeOps.getNodeRefsByTitle('KSampler')
      )[0]
      await comfyPage.nodeOps.selectNodeWithPan(nodeRef)

      const menu = await openMoreOptions(comfyPage)
      await menu.getByText('Rename', { exact: true }).click()

      await expect(comfyPage.page.getByTestId('node-title-input')).toHaveValue(
        'KSampler'
      )
    })

    test('Rename shows prompt dialog for group', async ({ comfyPage }) => {
      await comfyPage.settings.setSetting(
        'LiteGraph.Group.SelectChildrenOnClick',
        false
      )
      await comfyPage.workflow.loadWorkflow('groups/nested-groups-1-inner-node')
      await comfyPage.nextFrame()

      const outerGroupPos = await getGroupTitlePosition(
        comfyPage,
        'Outer Group'
      )
      await comfyPage.canvas.click({ position: outerGroupPos })

      const menu = await openMoreOptions(comfyPage)
      await menu.getByText('Rename', { exact: true }).click()

      await expect(comfyPage.nodeOps.promptDialogInput).toBeVisible()
      await comfyPage.nodeOps.promptDialogInput.fill('Renamed Group')
      await comfyPage.page.keyboard.press('Enter')
      await expect(comfyPage.nodeOps.promptDialogInput).toBeHidden()

      await expect
        .poll(() =>
          comfyPage.page.evaluate(() => {
            return window.app!.graph.groups.some(
              (g) => g.title === 'Renamed Group'
            )
          })
        )
        .toBe(true)
    })
  })

  test.describe('Batch rename', () => {
    test('Batch rename multiple selected nodes', async ({ comfyPage }) => {
      const ksampler = (
        await comfyPage.nodeOps.getNodeRefsByTitle('KSampler')
      )[0]
      const emptyLatent = (
        await comfyPage.nodeOps.getNodeRefsByTitle('Empty Latent Image')
      )[0]

      await comfyPage.nodeOps.selectNodes(['KSampler', 'Empty Latent Image'])

      const menu = await openMoreOptions(comfyPage)
      await menu.getByText('Rename', { exact: true }).click()

      await expect(comfyPage.nodeOps.promptDialogInput).toBeVisible()
      await comfyPage.nodeOps.promptDialogInput.fill('TestNode')
      await comfyPage.page.keyboard.press('Enter')
      await expect(comfyPage.nodeOps.promptDialogInput).toBeHidden()

      await expect
        .poll(async () => {
          const titles = await Promise.all([
            ksampler.getProperty<string>('title'),
            emptyLatent.getProperty<string>('title')
          ])
          return [...titles].sort()
        })
        .toEqual(['TestNode 1', 'TestNode 2'])
    })
  })
})
