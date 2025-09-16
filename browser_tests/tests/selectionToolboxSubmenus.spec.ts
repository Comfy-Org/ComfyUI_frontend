import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'

test.describe('Selection Toolbox - More Options Submenus', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.setSetting('Comfy.Canvas.SelectionToolbox', true)
    await comfyPage.loadWorkflow('nodes/single_ksampler')
    await comfyPage.nextFrame()
    await comfyPage.selectNodes(['KSampler'])
    await comfyPage.nextFrame()
  })

  const openMoreOptions = async (comfyPage: any) => {
    const ksamplerNodes = await comfyPage.getNodeRefsByTitle('KSampler')
    if (ksamplerNodes.length === 0) {
      throw new Error('No KSampler nodes found')
    }

    // Drag the KSampler to the center of the screen
    const nodePos = await ksamplerNodes[0].getPosition()
    const viewportSize = comfyPage.page.viewportSize()
    const centerX = viewportSize.width / 3
    const centerY = viewportSize.height / 2
    await comfyPage.dragAndDrop(
      { x: nodePos.x, y: nodePos.y },
      { x: centerX, y: centerY }
    )
    await comfyPage.nextFrame()

    await ksamplerNodes[0].click('title')
    await comfyPage.nextFrame()
    await comfyPage.page.waitForTimeout(500)

    await expect(comfyPage.page.locator('.selection-toolbox')).toBeVisible({
      timeout: 5000
    })

    const moreOptionsBtn = comfyPage.page.locator(
      '[data-testid="more-options-button"]'
    )
    await expect(moreOptionsBtn).toBeVisible({ timeout: 3000 })

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
    await comfyPage.page.waitForTimeout(2000)

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
    const nodeRef = (await comfyPage.getNodeRefsByTitle('KSampler'))[0]
    const initialShape = await nodeRef.getProperty<number>('shape')

    await openMoreOptions(comfyPage)
    await comfyPage.page.getByText('Shape', { exact: true }).click()
    await expect(comfyPage.page.getByText('Box', { exact: true })).toBeVisible({
      timeout: 5000
    })
    await comfyPage.page.getByText('Box', { exact: true }).click()
    await comfyPage.nextFrame()

    const newShape = await nodeRef.getProperty<number>('shape')
    expect(newShape).not.toBe(initialShape)
    expect(newShape).toBe(1)
  })

  test('changes node color via Color submenu swatch', async ({ comfyPage }) => {
    const nodeRef = (await comfyPage.getNodeRefsByTitle('KSampler'))[0]
    const initialColor = await nodeRef.getProperty<string | undefined>('color')

    await openMoreOptions(comfyPage)
    await comfyPage.page.getByText('Color', { exact: true }).click()
    const blueSwatch = comfyPage.page.locator('[title="Blue"]')
    await expect(blueSwatch.first()).toBeVisible({ timeout: 5000 })
    await blueSwatch.first().click()
    await comfyPage.nextFrame()

    const newColor = await nodeRef.getProperty<string | undefined>('color')
    expect(newColor).toBe('#223')
    if (initialColor) {
      expect(newColor).not.toBe(initialColor)
    }
  })

  test('renames a node using Rename action', async ({ comfyPage }) => {
    const nodeRef = (await comfyPage.getNodeRefsByTitle('KSampler'))[0]
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
    const newTitle = await nodeRef.getProperty<string>('title')
    expect(newTitle).toBe('RenamedNode')
  })

  test('closes More Options menu when clicking outside', async ({
    comfyPage
  }) => {
    await openMoreOptions(comfyPage)
    await expect(
      comfyPage.page.getByText('Rename', { exact: true })
    ).toBeVisible({ timeout: 5000 })

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
    ).toBeVisible({ timeout: 5000 })

    await comfyPage.page.evaluate(() => {
      const btn = document.querySelector('[data-testid="more-options-button"]')
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
    await comfyPage.page.waitForTimeout(500)

    await expect(
      comfyPage.page.getByText('Rename', { exact: true })
    ).not.toBeVisible()
  })
})
