import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { expectDialogBoundsWithDockedPanel } from '@e2e/fixtures/utils/workspaceInset'

test.describe('Dialog layout with a docked Agent panel', () => {
  for (const { viewportWidth, x, outcome } of [
    { viewportWidth: 1440, x: 8, outcome: 'covers the panel from the gutter' },
    { viewportWidth: 1920, x: 50, outcome: 'centres beside the panel' }
  ]) {
    test.describe(`at a ${viewportWidth}px viewport`, () => {
      test.use({ viewport: { width: viewportWidth, height: 800 } })

      test(`Templates browser keeps its size and ${outcome}`, async ({
        comfyPage
      }) => {
        await comfyPage.command.executeCommand('Comfy.BrowseTemplates')
        await expect(comfyPage.templates.content).toBeVisible()

        await expectDialogBoundsWithDockedPanel(
          comfyPage.page,
          comfyPage.templatesDialog.root,
          { panelWidth: 420, x }
        )
      })
    })
  }

  test.describe('at the sm breakpoint', () => {
    test.use({ viewport: { width: 640, height: 800 } })

    test('a size-variant dialog keeps its width and stops at the gutter', async ({
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
        { panelWidth: 420, x: 8 }
      )
    })
  })
})
