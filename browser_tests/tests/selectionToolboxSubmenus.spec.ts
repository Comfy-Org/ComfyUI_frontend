import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'

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
      await comfyPage.nextFrame()
      await comfyPage.nodeOps.selectNodes(['KSampler'])
      await comfyPage.nextFrame()
    })

    const openMoreOptions = async (comfyPage: ComfyPage) => {
      const ksamplerNodes =
        await comfyPage.nodeOps.getNodeRefsByTitle('KSampler')
      if (ksamplerNodes.length === 0) {
        throw new Error('No KSampler nodes found')
      }

      // Drag the KSampler to the center of the screen
      const nodePos = await ksamplerNodes[0].getPosition()
      const viewportSize = comfyPage.page.viewportSize()
      if (!viewportSize) {
        throw new Error(
          'Viewport size is null - page may not be properly initialized'
        )
      }
      const centerX = viewportSize.width / 3
      const centerY = viewportSize.height / 2
      await comfyPage.canvasOps.dragAndDrop(
        { x: nodePos.x, y: nodePos.y },
        { x: centerX, y: centerY }
      )
      await comfyPage.nextFrame()

      await ksamplerNodes[0].click('title')
      await comfyPage.nextFrame()

      await expect(comfyPage.page.locator('.selection-toolbox')).toBeVisible()

      const moreOptionsBtn = comfyPage.page.locator(
        '[data-testid="more-options-button"]'
      )
      await expect(moreOptionsBtn).toBeVisible()

      await comfyPage.page.click('[data-testid="more-options-button"]')

      await comfyPage.nextFrame()

      const menuOptionsVisible = await comfyPage.page
        .getByText('Rename')
        .isVisible({ timeout: 2000 })
        .catch(() => false)
      if (menuOptionsVisible) {
        return
      }

      await moreOptionsBtn.click({ force: true })
      await comfyPage.nextFrame()

      const menuOptionsVisibleAfterClick = await comfyPage.page
        .getByText('Rename')
        .isVisible({ timeout: 2000 })
        .catch(() => false)
      if (menuOptionsVisibleAfterClick) {
        return
      }

      throw new Error('Could not open More Options menu - popover not showing')
    }

    test('opens Node Info from More Options menu', async ({ comfyPage }) => {
      await openMoreOptions(comfyPage)
      const nodeInfoButton = comfyPage.page.getByText('Node Info', {
        exact: true
      })
      await expect(nodeInfoButton).toBeVisible()
      await nodeInfoButton.click()
      await comfyPage.nextFrame()
    })

    test('changes node shape via Shape submenu', async ({ comfyPage }) => {
      const nodeRef = (
        await comfyPage.nodeOps.getNodeRefsByTitle('KSampler')
      )[0]

      await openMoreOptions(comfyPage)
      await comfyPage.page.getByText('Shape', { exact: true }).hover()
      await expect(
        comfyPage.page.getByText('Box', { exact: true })
      ).toBeVisible()
      await comfyPage.page.getByText('Box', { exact: true }).click()
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
      await comfyPage.page.getByText('Color', { exact: true }).click()
      const blueSwatch = comfyPage.page.locator('[title="Blue"]')
      await expect(blueSwatch.first()).toBeVisible()
      await blueSwatch.first().click()
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
      await comfyPage.page
        .getByText('Rename', { exact: true })
        .click({ force: true })
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

      // Wait for multiple frames to allow PrimeVue's outside click handler to initialize
      for (let i = 0; i < 30; i++) {
        await comfyPage.nextFrame()
      }

      await comfyPage.page
        .locator('#graph-canvas')
        .click({ position: { x: 0, y: 50 }, force: true })

      await comfyPage.nextFrame()
      await expect(
        comfyPage.page.getByText('Rename', { exact: true })
      ).not.toBeVisible()
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
      ).not.toBeVisible()
    })
  }
)
