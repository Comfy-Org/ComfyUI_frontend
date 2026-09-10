import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { openMoreOptionsMenu } from '@e2e/fixtures/utils/selectionToolboxMoreOptions'

test.beforeEach(async ({ comfyPage }) => {
  await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
})

test.describe(
  'Selection Toolbox - More Options Submenus',
  { tag: '@ui' },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.Canvas.SelectionToolbox', true)
      await comfyPage.workflow.loadWorkflow('nodes/single_ksampler')
      await comfyPage.nodeOps.selectNodes(['KSampler'])
      await comfyPage.nextFrame()
    })

    const openMoreOptions = (comfyPage: ComfyPage) =>
      openMoreOptionsMenu(comfyPage, 'KSampler')

    test('hides Node Info from More Options menu when the new menu is disabled', async ({
      comfyPage
    }) => {
      await comfyPage.settings.setSetting('Comfy.NodeLibrary.NewDesign', false)

      await openMoreOptions(comfyPage)
      const nodeInfoButton = comfyPage.page.getByRole('menuitem', {
        name: 'Node Info'
      })
      await expect(nodeInfoButton).toBeHidden()
    })

    test('changes node shape via Shape submenu', async ({ comfyPage }) => {
      const nodeRef = (
        await comfyPage.nodeOps.getNodeRefsByTitle('KSampler')
      )[0]

      await openMoreOptions(comfyPage)
      await comfyPage.contextMenu.menuItem('Shape').click()
      const boxItem = comfyPage.page.getByRole('menuitem', {
        name: 'Box',
        exact: true
      })
      await expect(boxItem).toBeVisible()
      await boxItem.click()
      await comfyPage.nextFrame()

      await expect.poll(() => nodeRef.getProperty<number>('shape')).toBe(1)
    })

    test('changes node color via Color submenu swatch', async ({
      comfyPage
    }) => {
      const nodeRef = (
        await comfyPage.nodeOps.getNodeRefsByTitle('KSampler')
      )[0]

      await openMoreOptions(comfyPage)
      await comfyPage.contextMenu.menuItem('Color').click()
      const blueSwatch = comfyPage.page.getByRole('menuitem', {
        name: 'Blue',
        exact: true
      })
      await expect(blueSwatch).toBeVisible()
      await blueSwatch.click()
      await comfyPage.nextFrame()

      await expect
        .poll(() => nodeRef.getProperty<string | undefined>('color'))
        .toBe('#223')
    })

    test('renames a node using Rename action', async ({ comfyPage }) => {
      const nodeRef = (
        await comfyPage.nodeOps.getNodeRefsByTitle('KSampler')
      )[0]
      await openMoreOptions(comfyPage)
      await comfyPage.page.getByText('Rename', { exact: true }).click()
      const input = comfyPage.page.locator(
        '.group-title-editor.node-title-editor .editable-text input'
      )
      await expect(input).toBeVisible()
      await input.fill('RenamedNode')
      await input.press('Enter')
      await comfyPage.nextFrame()
      await expect
        .poll(() => nodeRef.getProperty<string>('title'))
        .toBe('RenamedNode')
    })

    test('closes More Options menu when clicking outside', async ({
      comfyPage
    }) => {
      await openMoreOptions(comfyPage)
      const renameItem = comfyPage.page.getByText('Rename', { exact: true })
      await expect(renameItem).toBeVisible()

      for (let i = 0; i < 30; i++) {
        await comfyPage.nextFrame()
      }

      await comfyPage.canvasOps.mouseClickAt({ x: 0, y: 50 })
      await expect(
        comfyPage.page.getByText('Rename', { exact: true })
      ).toBeHidden()
    })

    test('closes More Options menu when clicking the button again (toggle)', async ({
      comfyPage
    }) => {
      await openMoreOptions(comfyPage)
      await expect(
        comfyPage.page.getByText('Rename', { exact: true })
      ).toBeVisible()

      await comfyPage.page.evaluate(() => {
        const btn = document.querySelector(
          '[data-testid="more-options-button"]'
        )
        if (btn) {
          const event = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window,
            detail: 1
          })
          btn.dispatchEvent(event)
        }
      })
      await comfyPage.nextFrame()

      await expect(
        comfyPage.page.getByText('Rename', { exact: true })
      ).toBeHidden()
    })
  }
)
