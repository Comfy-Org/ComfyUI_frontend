import { expect } from '@playwright/test'
import type { Locator } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import type { ComfyMouse } from '@e2e/fixtures/ComfyMouse'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'
import { agentTest } from '@e2e/tests/agent/agentPanelMocks'

test.describe('Sidebar splitter width independence', () => {
  test.use({
    initialSettings: {
      'Comfy.NodeLibrary.NewDesign': false
    }
  })

  async function dismissToasts(comfyPage: ComfyPage) {
    const buttons = await comfyPage.page.locator('.p-toast-close-button').all()
    for (const btn of buttons) {
      await btn.click({ timeout: 2000 }).catch(() => {})
    }
    // Brief wait for animations
    await comfyPage.nextFrame()
  }

  async function openSidebarAt(
    comfyPage: ComfyPage,
    location: 'left' | 'right'
  ) {
    await comfyPage.settings.setSetting('Comfy.Sidebar.Location', location)
    await dismissToasts(comfyPage)
    await comfyPage.menu.nodeLibraryTab.open()
  }

  test('persists a resize started in the gutter margin after reload and reopen', async ({
    comfyMouse,
    comfyPage
  }) => {
    await openSidebarAt(comfyPage, 'left')
    const sidebar = comfyPage.menu.nodeLibraryTab.panel
    const initialWidth = (await sidebar.boundingBox())?.width ?? 0

    await comfyPage.menu.nodeLibraryTab.resize(comfyMouse, 80, -4)
    await expect
      .poll(async () => (await sidebar.boundingBox())?.width ?? 0)
      .toBeGreaterThan(initialWidth + 40)
    const resizedWidth = (await sidebar.boundingBox())?.width ?? 0

    await comfyPage.workflow.reloadAndWaitForApp()
    await comfyPage.menu.nodeLibraryTab.open()
    await expect
      .poll(async () => (await sidebar.boundingBox())?.width ?? 0)
      .toBeCloseTo(resizedWidth, 0)

    await comfyPage.menu.nodeLibraryTab.close()
    await comfyPage.menu.nodeLibraryTab.open()
    await expect
      .poll(async () => (await sidebar.boundingBox())?.width ?? 0)
      .toBeCloseTo(resizedWidth, 0)
  })

  test('keeps sidebar search state and pixel width when the viewport resizes', async ({
    comfyMouse,
    comfyPage
  }) => {
    await comfyPage.page.setViewportSize({ width: 1400, height: 900 })
    await openSidebarAt(comfyPage, 'left')
    await comfyPage.menu.nodeLibraryTab.resize(comfyMouse, 80)
    const sidebar = comfyPage.page.getByRole('complementary', {
      name: enMessages.sideToolbar.sidebar
    })
    const width = (await sidebar.boundingBox())?.width
    const search = comfyPage.menu.nodeLibraryTab.nodeLibrarySearchBoxInput
    await search.fill('KSampler')
    await expect(search).toBeFocused()

    await comfyPage.page.setViewportSize({ width: 1200, height: 900 })

    await expect
      .poll(async () => (await sidebar.boundingBox())?.width)
      .toBeCloseTo(width ?? 0, 0)
    await expect(search).toHaveValue('KSampler')
    await expect(search).toBeFocused()
  })

  test('keeps the properties panel visible when the sidebar consumes the center space', async ({
    comfyMouse,
    comfyPage
  }) => {
    await comfyPage.menu.nodeLibraryTab.open()
    await comfyPage.actionbar.propertiesButton.click()
    await expect(comfyPage.menu.propertiesPanel.closeButton).toBeInViewport()

    await comfyPage.menu.nodeLibraryTab.resize(comfyMouse, 800)

    await expect(comfyPage.menu.propertiesPanel.closeButton).toBeInViewport()
  })

  test('persists both side panels when one drag resizes across the center minimum', async ({
    comfyMouse,
    comfyPage
  }) => {
    await comfyPage.page.setViewportSize({ width: 1400, height: 800 })
    await comfyPage.page.evaluate(() =>
      localStorage.setItem('Comfy.RightSidePanel.Width', '420')
    )
    await comfyPage.workflow.reloadAndWaitForApp()
    await openSidebarAt(comfyPage, 'left')
    await comfyPage.actionbar.propertiesButton.click()
    const sidebar = comfyPage.menu.nodeLibraryTab.panel
    const properties = comfyPage.page.getByTestId(TestIds.propertiesPanel.root)
    await expect
      .poll(async () => (await properties.boundingBox())?.width ?? 0)
      .toBeCloseTo(420, 0)

    await comfyPage.menu.nodeLibraryTab.resize(comfyMouse, 800)
    const sidebarWidth = (await sidebar.boundingBox())?.width ?? 0
    const propertiesWidth = (await properties.boundingBox())?.width ?? 0
    expect(propertiesWidth).toBeLessThan(340)

    await expect
      .poll(() =>
        comfyPage.page.evaluate(() => ({
          left: Math.round(
            Number(localStorage.getItem('Comfy.Sidebar.LeftWidth'))
          ),
          right: Math.round(
            Number(localStorage.getItem('Comfy.RightSidePanel.Width'))
          )
        }))
      )
      .toEqual({
        left: Math.round(sidebarWidth),
        right: Math.round(propertiesWidth)
      })

    await comfyPage.workflow.reloadAndWaitForApp()
    await comfyPage.menu.nodeLibraryTab.open()
    await comfyPage.actionbar.propertiesButton.click()
    await expect
      .poll(async () => (await sidebar.boundingBox())?.width ?? 0)
      .toBeCloseTo(sidebarWidth, 0)
    await expect
      .poll(async () => (await properties.boundingBox())?.width ?? 0)
      .toBeCloseTo(propertiesWidth, 0)
  })

  test('left and right sidebars use separate localStorage keys', async ({
    comfyMouse,
    comfyPage
  }) => {
    // Open sidebar on the left and resize it
    await openSidebarAt(comfyPage, 'left')
    await comfyPage.menu.nodeLibraryTab.resize(comfyMouse, 100)

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

  test('localStorage keys include sidebar location', async ({
    comfyMouse,
    comfyPage
  }) => {
    await openSidebarAt(comfyPage, 'left')
    await comfyPage.menu.nodeLibraryTab.resize(comfyMouse, 50)

    await expect
      .poll(() =>
        comfyPage.page.evaluate(() =>
          localStorage.getItem('Comfy.Sidebar.LeftWidth')
        )
      )
      .not.toBeNull()

    await comfyPage.menu.nodeLibraryTab.close()
    await openSidebarAt(comfyPage, 'right')
    await comfyPage.menu.nodeLibraryTab.resize(comfyMouse, -50)

    await expect
      .poll(() =>
        comfyPage.page.evaluate(() =>
          localStorage.getItem('Comfy.Sidebar.RightWidth')
        )
      )
      .not.toBeNull()

    await expect
      .poll(() =>
        comfyPage.page.evaluate(() =>
          localStorage.getItem('Comfy.Sidebar.LeftWidth')
        )
      )
      .not.toBeNull()
  })

  test('persists the resized sidebar width in pixels', async ({
    comfyMouse,
    comfyPage
  }) => {
    await openSidebarAt(comfyPage, 'left')
    await comfyPage.menu.nodeLibraryTab.resize(comfyMouse, 80)
    const width = await comfyPage.menu.nodeLibraryTab.panel.evaluate(
      (panel) => panel.getBoundingClientRect().width
    )
    await expect
      .poll(() =>
        comfyPage.page.evaluate(() =>
          Number(localStorage.getItem('Comfy.Sidebar.LeftWidth'))
        )
      )
      .toBeCloseTo(width, 0)
  })
})

agentTest.describe(
  'Sidebar width across neighbouring panel toggles',
  { tag: ['@cloud', '@ui'] },
  () => {
    agentTest.use({
      initialSettings: {
        'Comfy.Sidebar.Location': 'left',
        'Comfy.RightSidePanel.IsOpen': false
      }
    })

    function sidebarPanel(comfyPage: ComfyPage) {
      return comfyPage.page.getByRole('complementary', {
        name: enMessages.sideToolbar.sidebar
      })
    }

    async function widthOf(panel: Locator) {
      return (await panel.boundingBox())?.width ?? 0
    }

    async function widenSidebar(comfyPage: ComfyPage, comfyMouse: ComfyMouse) {
      const sidebar = sidebarPanel(comfyPage)
      const gutter = comfyPage.page.getByRole('separator').first()
      const box = await gutter.boundingBox()
      if (!box) throw new Error('Sidebar gutter is not visible')
      const widthBeforeDrag = await widthOf(sidebar)
      const x = box.x + box.width / 2
      const y = box.y + box.height / 2
      await comfyMouse.dragAndDrop({ x, y }, { x: x + 80, y })
      await expect
        .poll(() => widthOf(sidebar))
        .toBeGreaterThan(widthBeforeDrag + 40)
      return widthOf(sidebar)
    }

    async function expectWidthKept(
      comfyPage: ComfyPage,
      panel: Locator,
      width: number
    ) {
      await comfyPage.nextFrame()
      await expect
        .poll(async () => Math.abs((await widthOf(panel)) - width))
        .toBeLessThanOrEqual(2)
      await comfyPage.nextFrame()
      expect(Math.abs((await widthOf(panel)) - width)).toBeLessThanOrEqual(2)
    }

    agentTest(
      'keeps a dragged sidebar width when the Agent panel closes and reopens',
      async ({ agentPanel, comfyMouse, comfyPage }) => {
        const sidebar = sidebarPanel(comfyPage)
        await comfyPage.menu.assetsTab.open({ waitForAssets: false })
        await agentPanel.open()
        await expect(sidebar).toBeVisible()

        const draggedWidth = await widenSidebar(comfyPage, comfyMouse)

        await agentPanel.openButton.click()
        await expect(agentPanel.root).toHaveCount(0)
        await expectWidthKept(comfyPage, sidebar, draggedWidth)

        await agentPanel.open()
        await expectWidthKept(comfyPage, sidebar, draggedWidth)
      }
    )

    agentTest(
      'keeps a dragged sidebar width when the workflow overview opens',
      async ({ comfyMouse, comfyPage }) => {
        const sidebar = sidebarPanel(comfyPage)
        await comfyPage.menu.assetsTab.open({ waitForAssets: false })
        await expect(sidebar).toBeVisible()
        const openedWidth = await widenSidebar(comfyPage, comfyMouse)

        await comfyPage.actionbar.propertiesButton.click()
        await expect(
          comfyPage.page.getByTestId(TestIds.propertiesPanel.root)
        ).toBeVisible()

        await expectWidthKept(comfyPage, sidebar, openedWidth)
      }
    )
  }
)
