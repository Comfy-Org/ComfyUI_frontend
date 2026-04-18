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

  const menu = comfyPage.page.locator('.p-contextmenu')
  await expect(menu.getByText('Copy', { exact: true })).toBeVisible()
}

async function getGroupTitlePosition(
  comfyPage: ComfyPage,
  title: string
): Promise<{ x: number; y: number }> {
  const pos = await comfyPage.page.evaluate((title) => {
    const group = window.app!.rootGraph.groups.find((g) => g.title === title)
    if (!group) return null
    const clientPos = window.app!.canvasPosToClientPos([
      group.pos[0] + 50,
      group.pos[1] + 15
    ])
    return { x: clientPos[0], y: clientPos[1] }
  }, title)

  if (!pos) {
    throw new Error(`Group ${title} not found`)
  }

  return pos
}

test.describe('Selection toolbox paste and rename', { tag: '@ui' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.Canvas.SelectionToolbox', true)
    await comfyPage.workflow.loadWorkflow('default')
    await comfyPage.nextFrame()
  })

  test.describe('Paste operations', () => {
    test('Copy and paste creates new nodes', async ({ comfyPage }) => {
      const nodeRef = (
        await comfyPage.nodeOps.getNodeRefsByTitle('KSampler')
      )[0]
      await comfyPage.nodeOps.selectNodeWithPan(nodeRef)
      const initialCount = await comfyPage.nodeOps.getGraphNodesCount()

      await openMoreOptions(comfyPage)
      await comfyPage.page.getByText('Copy', { exact: true }).click()
      await comfyPage.nextFrame()

      await comfyPage.clipboard.paste()

      await expect
        .poll(() => comfyPage.nodeOps.getGraphNodesCount())
        .toBe(initialCount + 1)
    })

    test('Paste without copy is a no-op', async ({ comfyPage }) => {
      const initialCount = await comfyPage.nodeOps.getGraphNodesCount()

      await comfyPage.clipboard.paste()

      await expect
        .poll(() => comfyPage.nodeOps.getGraphNodesCount())
        .toBe(initialCount)
    })
  })

  test.describe('Single rename', () => {
    test('Rename via More Options opens title editor for single node', async ({
      comfyPage
    }) => {
      const nodeRef = (
        await comfyPage.nodeOps.getNodeRefsByTitle('KSampler')
      )[0]
      await comfyPage.nodeOps.selectNodeWithPan(nodeRef)

      await openMoreOptions(comfyPage)
      await comfyPage.page.getByText('Rename', { exact: true }).click()

      await expect
        .poll(() =>
          comfyPage.page.evaluate(() => {
            const input = document.querySelector<HTMLInputElement>(
              '.group-title-editor.node-title-editor input[data-testid="node-title-input"]'
            )
            return input?.value ?? null
          })
        )
        .toBe('KSampler')
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
      await comfyPage.nextFrame()

      await openMoreOptions(comfyPage)
      await comfyPage.page.getByText('Rename', { exact: true }).click()

      await expect(comfyPage.nodeOps.promptDialogInput).toBeVisible()
      await comfyPage.nodeOps.promptDialogInput.fill('Renamed Group')
      await comfyPage.page.keyboard.press('Enter')
      await expect(comfyPage.nodeOps.promptDialogInput).toBeHidden()

      await expect
        .poll(() =>
          comfyPage.page.evaluate(() => {
            return window.app!.rootGraph.groups.some(
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

      await openMoreOptions(comfyPage)
      await comfyPage.page.getByText('Rename', { exact: true }).click()

      await expect(comfyPage.nodeOps.promptDialogInput).toBeVisible()
      await comfyPage.nodeOps.promptDialogInput.fill('TestNode')
      await comfyPage.page.keyboard.press('Enter')
      await expect(comfyPage.nodeOps.promptDialogInput).toBeHidden()

      await expect
        .poll(() => ksampler.getProperty<string>('title'))
        .toBe('TestNode 1')
      await expect
        .poll(() => emptyLatent.getProperty<string>('title'))
        .toBe('TestNode 2')
    })

    test('Rename with empty selection shows warning toast', async ({
      comfyPage
    }) => {
      const nodeRef = (
        await comfyPage.nodeOps.getNodeRefsByTitle('KSampler')
      )[0]
      await comfyPage.nodeOps.selectNodeWithPan(nodeRef)

      await openMoreOptions(comfyPage)
      const renameItem = comfyPage.page.getByText('Rename', { exact: true })
      await expect(renameItem).toBeVisible()

      await comfyPage.page.evaluate(() => {
        window.app!.canvas.deselectAll()
      })
      await comfyPage.nextFrame()

      await renameItem.click()

      await expect(comfyPage.toast.visibleToasts.first()).toBeVisible()
      await expect(comfyPage.toast.visibleToasts.first()).toContainText(
        /rename/i
      )
    })
  })
})
