import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { expectDialogBoundsWithDockedPanel } from '@e2e/fixtures/utils/workspaceInset'

const viewportCases = [
  {
    name: '1440px',
    viewportWidth: 1440,
    expectedOverlayBounds: { x: 0, y: 0, width: 1440, height: 800 }
  },
  {
    name: '1920px',
    viewportWidth: 1920,
    expectedOverlayBounds: { x: 0, y: 0, width: 1920, height: 800 }
  }
]

test.describe('Dialog layout with a docked Agent panel', () => {
  for (const { name, viewportWidth, expectedOverlayBounds } of viewportCases) {
    test.describe(`at a ${name} viewport`, () => {
      test.use({ viewport: { width: viewportWidth, height: 800 } })

      test('Templates browser stays centered at every panel width', async ({
        comfyPage
      }) => {
        await comfyPage.command.executeCommand('Comfy.BrowseTemplates')
        await expect(comfyPage.templates.content).toBeVisible()

        await expectDialogBoundsWithDockedPanel(
          comfyPage.page,
          comfyPage.templatesDialog.root,
          { panelWidths: [0, 420, 960] }
        )

        await expect(comfyPage.page.getByTestId('dialog-overlay')).toHaveBounds(
          expectedOverlayBounds,
          { numDigits: 1 }
        )
      })
    })
  }

  test.describe('at the sm breakpoint', () => {
    test.use({ viewport: { width: 640, height: 800 } })

    test('a size-variant dialog stays viewport-centered and keeps its width', async ({
      comfyPage
    }) => {
      await comfyPage.page.evaluate(() => {
        window
          .app!.extensionManager.dialog.confirm({
            title: 'Confirm',
            type: 'default',
            message: 'Does this dialog keep its width?'
          })
          .catch(() => {})
      })
      await expect(comfyPage.confirmDialog.root).toBeVisible()

      await expectDialogBoundsWithDockedPanel(
        comfyPage.page,
        comfyPage.confirmDialog.root,
        { panelWidths: [0, 420] }
      )
    })
  })
})
