import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

test.describe('Sidebar splitter width independence', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
    await comfyPage.settings.setSetting('Comfy.Sidebar.UnifiedWidth', true)
    await comfyPage.settings.setSetting('Comfy.NodeLibrary.NewDesign', false)
  })

  async function dismissToasts(comfyPage: ComfyPage) {
    const buttons = await comfyPage.page.locator('.p-toast-close-button').all()
    for (const btn of buttons) {
      await btn.click({ timeout: 2000 }).catch(() => {})
    }
    // Brief wait for animations
    await comfyPage.nextFrame()
  }

  async function dragGutter(comfyPage: ComfyPage, deltaX: number) {
    const gutter = comfyPage.page
      .locator('.p-splitter-gutter:not(.hidden)')
      .first()
    await expect(gutter).toBeVisible()
    let box: Awaited<ReturnType<typeof gutter.boundingBox>> = null
    await expect
      .poll(async () => {
        box = await gutter.boundingBox()
        return box
      })
      .not.toBeNull()
    const centerX = box!.x + box!.width / 2
    const centerY = box!.y + box!.height / 2
    await comfyPage.page.mouse.move(centerX, centerY)
    await comfyPage.page.mouse.down()
    await comfyPage.page.mouse.move(centerX + deltaX, centerY, { steps: 10 })
    await comfyPage.page.mouse.up()
    await comfyPage.nextFrame()
  }

  async function openSidebarAt(
    comfyPage: ComfyPage,
    location: 'left' | 'right'
  ) {
    await comfyPage.settings.setSetting('Comfy.Sidebar.Location', location)
    await comfyPage.nextFrame()
    await dismissToasts(comfyPage)
    await comfyPage.menu.nodeLibraryTab.open()
  }

  test('left and right sidebars use separate localStorage keys', async ({
    comfyPage
  }) => {
    // Open sidebar on the left and resize it
    await openSidebarAt(comfyPage, 'left')
    await dragGutter(comfyPage, 100)

    // Read the sidebar panel width after resize
    const leftSidebar = comfyPage.page.locator('.side-bar-panel').first()
    const leftWidth = (await leftSidebar.boundingBox())!.width

    // Close sidebar, switch to right, open again
    await comfyPage.menu.nodeLibraryTab.close()
    await openSidebarAt(comfyPage, 'right')

    // Right sidebar should use its default width, not the left's resized width
    const rightSidebar = comfyPage.page.locator('.side-bar-panel').first()
    await expect(rightSidebar).toBeVisible()

    // The right sidebar should NOT match the left's resized width.
    // We dragged the left sidebar 100px wider, so there should be a noticeable
    // difference between the left (resized) and right (default) widths.
    await expect
      .poll(async () => {
        const b = await rightSidebar.boundingBox()
        return b ? Math.abs(b.width - leftWidth) : -1
      })
      .toBeGreaterThan(50)
  })

  test('localStorage keys include sidebar location', async ({ comfyPage }) => {
    // Open sidebar on the left and resize
    await openSidebarAt(comfyPage, 'left')
    await dragGutter(comfyPage, 50)

    // Left-only sidebar should use the legacy key (no location suffix)
    await expect
      .poll(() =>
        comfyPage.page.evaluate(() => localStorage.getItem('unified-sidebar'))
      )
      .not.toBeNull()

    // Switch to right and resize
    await comfyPage.menu.nodeLibraryTab.close()
    await openSidebarAt(comfyPage, 'right')
    await dragGutter(comfyPage, -50)

    // Right sidebar should use a different key with location suffix
    await expect
      .poll(() =>
        comfyPage.page.evaluate(() =>
          localStorage.getItem('unified-sidebar-right')
        )
      )
      .not.toBeNull()

    // Both keys should exist independently
    await expect
      .poll(() =>
        comfyPage.page.evaluate(() => localStorage.getItem('unified-sidebar'))
      )
      .not.toBeNull()
  })

  test('normalized panel sizes sum to approximately 100%', async ({
    comfyPage
  }) => {
    await openSidebarAt(comfyPage, 'left')
    await dragGutter(comfyPage, 80)

    // Check that saved sizes sum to ~100%
    const getSidebarSizes = () =>
      comfyPage.page.evaluate(() => {
        const raw = localStorage.getItem('unified-sidebar')
        return raw ? (JSON.parse(raw) as number[]) : null
      })

    await expect
      .poll(async () => {
        const sizes = await getSidebarSizes()
        return Array.isArray(sizes)
      })
      .toBe(true)

    await expect
      .poll(async () => {
        const sizes = await getSidebarSizes()
        if (!sizes) return 0
        return sizes.reduce((a, b) => a + b, 0)
      })
      .toBeGreaterThan(99)

    await expect
      .poll(async () => {
        const sizes = await getSidebarSizes()
        if (!sizes) return Infinity
        return sizes.reduce((a, b) => a + b, 0)
      })
      .toBeLessThanOrEqual(101)
  })
})
