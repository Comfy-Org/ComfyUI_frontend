import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import {
  expectDialogEntersOnScreen,
  expectDialogHoldsSizeWhenPanelDocks
} from '@e2e/fixtures/utils/workspaceInset'

/**
 * A docked Agent panel publishes its width as `--workspace-inset-right`, and
 * dialogs shift left to stay beside it. Opening the panel — which happens
 * unprompted for first-time users — must not resize a dialog or push it off
 * screen, which inset-aware sizing and an unclamped shift used to do (PM-1865).
 */
const templateViewports = [
  { room: 'too narrow for the dialog beside the panel', width: 1280 },
  { room: 'the width PM-1865 was reported at', width: 1440 },
  { room: 'wide enough for both', width: 1920 }
]

/** `sm:` applies from 640px, which is where the size variants start to bind. */
const sizeVariantViewports = [
  { room: 'exactly at the sm breakpoint', width: 640 },
  { room: 'above the sm breakpoint', width: 800 }
]

test.describe('Dialog layout against the docked Agent panel', () => {
  test.describe('the Templates browser, which pins its own max-width', () => {
    for (const { room, width } of templateViewports) {
      test.describe(`on a viewport ${room}`, () => {
        test.use({ viewport: { width, height: 800 } })

        test('keeps its size and stays on screen', async ({ comfyPage }) => {
          await comfyPage.command.executeCommand('Comfy.BrowseTemplates')
          await expect(comfyPage.templates.content).toBeVisible()

          await expectDialogHoldsSizeWhenPanelDocks(
            comfyPage.page,
            comfyPage.templatesDialog.root,
            width
          )
        })
      })
    }
  })

  test.describe('a dialog sized by its size variant', () => {
    for (const { room, width } of sizeVariantViewports) {
      test.describe(`on a viewport ${room}`, () => {
        test.use({ viewport: { width, height: 800 } })

        test('keeps the width its variant asks for', async ({ comfyPage }) => {
          await comfyPage.page.evaluate(() => {
            window
              .app!.extensionManager.dialog.confirm({
                title: 'Confirm',
                type: 'default',
                message: 'Does this dialog keep its width?'
              })
              .catch(() => {})
          })

          const dialog = comfyPage.confirmDialog.root
          await expect(dialog).toBeVisible()

          await expectDialogHoldsSizeWhenPanelDocks(
            comfyPage.page,
            dialog,
            width
          )
        })
      })
    }
  })

  /**
   * `useManagerSurveyDialog` ships `w-full` with no unprefixed `max-w-*`, so
   * below `sm` it is exactly as wide as the viewport and has no slack to spend
   * on the gutter the clamp would otherwise hold back.
   */
  test.describe('a dialog as wide as the viewport', () => {
    const width = 600
    test.use({ viewport: { width, height: 800 } })

    test('sits flush rather than hanging off the edge', async ({
      comfyPage
    }) => {
      await comfyPage.page.evaluate(() => {
        window.app!.extensionManager.dialog.showLayoutDialog({
          key: 'viewport-wide-dialog',
          component: { setup: () => () => null },
          props: {},
          dialogComponentProps: {
            contentClass: 'w-full sm:max-w-lg rounded-2xl overflow-hidden'
          }
        })
      })

      const dialog = comfyPage.page.locator(
        '[data-dialog-key="viewport-wide-dialog"]'
      )
      await expect(dialog).toBeVisible()

      await expectDialogHoldsSizeWhenPanelDocks(comfyPage.page, dialog, width)
    })
  })

  test.describe('every dialog, while it opens', () => {
    test.use({ viewport: { width: 1440, height: 900 } })

    test('never leaves the viewport mid-animation', async ({ comfyPage }) => {
      await expectDialogEntersOnScreen(
        comfyPage.page,
        'w-[90vw] max-w-[1400px] sm:max-w-[1400px] h-[80vh]'
      )
    })
  })
})
