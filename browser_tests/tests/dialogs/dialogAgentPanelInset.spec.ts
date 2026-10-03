import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import {
  DOCKED_AGENT_PANEL_WIDTH,
  dialogViewportGutter,
  publishWorkspaceInsetRight
} from '@e2e/fixtures/utils/workspaceInset'

/**
 * A docked Agent panel publishes its width as `--workspace-inset-right`, and
 * dialogs shift left to stay beside it. Opening the panel — which happens
 * unprompted for first-time users — must not resize a dialog or push it off
 * screen, which inset-aware sizing and an unclamped shift used to do (PM-1865).
 */
const templateViewports = [
  { room: 'too narrow for the dialog beside the panel', width: 1280 },
  { room: 'wide enough for both', width: 1920 }
]

test.describe('Dialog layout against the docked Agent panel', () => {
  test.describe('the Templates browser', () => {
    for (const { room, width } of templateViewports) {
      test.describe(`on a viewport ${room}`, () => {
        test.use({ viewport: { width, height: 800 } })

        test('keeps its size and stays on screen', async ({ comfyPage }) => {
          await comfyPage.command.executeCommand('Comfy.BrowseTemplates')
          await expect(comfyPage.templates.content).toBeVisible()

          const dialog = comfyPage.templatesDialog.root
          await expect
            .poll(() =>
              dialog.evaluate((element) => element.getAnimations().length)
            )
            .toBe(0)
          const withoutPanel = await dialog.boundingBox()
          if (!withoutPanel) throw new Error('Templates dialog is not laid out')

          await publishWorkspaceInsetRight(
            comfyPage.page,
            DOCKED_AGENT_PANEL_WIDTH
          )

          await expect(dialog).toHaveBounds(
            {
              ...withoutPanel,
              x: Math.max(
                await dialogViewportGutter(comfyPage.page),
                (width - DOCKED_AGENT_PANEL_WIDTH - withoutPanel.width) / 2
              )
            },
            { numDigits: 1 }
          )
        })
      })
    }
  })

  test.describe('a dialog sized by its size variant', () => {
    const width = 800
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
      await expect
        .poll(() =>
          dialog.evaluate((element) => element.getAnimations().length)
        )
        .toBe(0)
      const withoutPanel = await dialog.boundingBox()
      if (!withoutPanel) throw new Error('Confirm dialog is not laid out')

      await publishWorkspaceInsetRight(comfyPage.page, DOCKED_AGENT_PANEL_WIDTH)

      await expect(dialog).toHaveBounds(
        {
          ...withoutPanel,
          x: Math.max(
            await dialogViewportGutter(comfyPage.page),
            (width - DOCKED_AGENT_PANEL_WIDTH - withoutPanel.width) / 2
          )
        },
        { numDigits: 1 }
      )
    })
  })
})
