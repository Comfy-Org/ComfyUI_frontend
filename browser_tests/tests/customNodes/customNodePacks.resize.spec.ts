import {
  ComfyPage,
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { APP_URL, setupCloudApp } from '@e2e/fixtures/utils/cloudAppSetup'
import { workspace } from '@e2e/fixtures/utils/workspaceMocks'

const editorSession = {
  id: 'resize-session',
  mode: 'create',
  name: 'Checkerboard Mask',
  status: 'ready',
  editor_url: '/custom-node-editor-fixture',
  created_at: '2026-08-29T12:00:00Z',
  updated_at: '2026-08-29T12:00:00Z'
}

test.describe(
  'Responsive custom node editor',
  { tag: ['@cloud', '@ui'] },
  () => {
    test.beforeEach(async ({ page }) => {
      await setupCloudApp(page, {
        workspace: workspace('personal', 'owner')
      })
      await page.route('**/api/customnodes', async (route) => {
        await route.fulfill({ json: [] })
      })
      await page.route('**/api/customnodes/editor/sessions', async (route) => {
        await route.fulfill({ status: 202, json: editorSession })
      })
      await page.route(
        '**/api/customnodes/editor/sessions/resize-session',
        async (route) => {
          await route.fulfill({ json: editorSession })
        }
      )
      await page.route('**/custom-node-editor-fixture', async (route) => {
        await route.fulfill({
          contentType: 'text/html',
          body: '<!doctype html><html><body style="margin:0"><main data-testid="editor-surface" style="width:100vw;height:100vh"></main></body></html>'
        })
      })
    })

    test('resizes the base app and editor iframe with the viewport', async ({
      page,
      request
    }) => {
      const comfyPage = new ComfyPage(page, request)
      await page.goto(APP_URL)
      await comfyPage.waitForAppReady()

      const closeWarning = page
        .getByRole('alert')
        .getByRole('button', { name: 'Close' })
      if (await closeWarning.isVisible()) {
        await closeWarning.click()
      }

      const closeTemplateDialog = page.getByRole('button', {
        name: 'Close dialog'
      })
      if (await closeTemplateDialog.isVisible()) {
        await closeTemplateDialog.click()
      }

      await comfyPage.menu.nodeLibraryTabV2.open()
      await page.setViewportSize({ width: 360, height: 640 })

      await expect
        .poll(
          async () =>
            await page.evaluate(() => {
              const root = document.querySelector<HTMLElement>('#vue-app')
              const graph = document.querySelector<HTMLElement>(
                '#graph-canvas-container'
              )
              return {
                documentWidth: document.documentElement.scrollWidth,
                graphWidth: Math.round(
                  graph?.getBoundingClientRect().width ?? 0
                ),
                rootHeight: Math.round(
                  root?.getBoundingClientRect().height ?? 0
                ),
                rootWidth: Math.round(root?.getBoundingClientRect().width ?? 0)
              }
            })
        )
        .toMatchObject({ documentWidth: 360, rootHeight: 640, rootWidth: 360 })
      expect(
        await page
          .locator('#graph-canvas-container')
          .evaluate((element) => element.getBoundingClientRect().width)
      ).toBeGreaterThan(0)

      await page.setViewportSize({ width: 1200, height: 800 })
      const customNodesButton =
        comfyPage.menu.nodeLibraryTabV2.sidebarContent.getByRole('button', {
          name: 'Custom Nodes',
          exact: true
        })
      await customNodesButton.click()
      await page.getByRole('button', { name: 'Create', exact: true }).click()
      await page
        .getByTestId('custom-node-create-dialog')
        .getByRole('button', { name: 'Create', exact: true })
        .click()

      const dialog = page.getByRole('dialog')
      const editorFrame = page.getByTitle('Custom node code editor')
      await expect(dialog).toBeVisible()
      await expect(editorFrame).toBeVisible()

      await page.setViewportSize({ width: 480, height: 360 })
      await expect
        .poll(async () => {
          const dialogBox = await dialog.boundingBox()
          const frameBox = await editorFrame.boundingBox()
          const frameViewport = await editorFrame
            .contentFrame()
            .getByTestId('editor-surface')
            .evaluate(() => ({ height: innerHeight, width: innerWidth }))
          return {
            dialog: dialogBox && {
              height: Math.round(dialogBox.height),
              width: Math.round(dialogBox.width),
              x: Math.round(dialogBox.x),
              y: Math.round(dialogBox.y)
            },
            frame: frameBox && {
              bottom: Math.round(frameBox.y + frameBox.height),
              right: Math.round(frameBox.x + frameBox.width),
              x: Math.round(frameBox.x)
            },
            frameViewport
          }
        })
        .toEqual({
          dialog: { height: 360, width: 480, x: 0, y: 0 },
          frame: { bottom: 360, right: 480, x: 0 },
          frameViewport: { height: 304, width: 480 }
        })

      await page.setViewportSize({ width: 1100, height: 700 })
      await expect
        .poll(async () => {
          const dialogBox = await dialog.boundingBox()
          const frameBox = await editorFrame.boundingBox()
          return {
            dialogHeight: Math.round(dialogBox?.height ?? 0),
            dialogWidth: Math.round(dialogBox?.width ?? 0),
            frameBottom: Math.round(
              (frameBox?.y ?? 0) + (frameBox?.height ?? 0)
            ),
            frameRight: Math.round((frameBox?.x ?? 0) + (frameBox?.width ?? 0))
          }
        })
        .toEqual({
          dialogHeight: 700,
          dialogWidth: 1100,
          frameBottom: 700,
          frameRight: 1100
        })
    })
  }
)
