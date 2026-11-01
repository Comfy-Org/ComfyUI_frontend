import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

const DISABLED = 'Test.DisabledShortcutPack'
const ENABLED = 'Test.EnabledShortcutPack'

test.use({ initialSettings: { 'Comfy.Extension.Disabled': [DISABLED] } })

test.describe(
  'Disabled third-party extension shortcuts',
  { tag: ['@settings', '@keyboard'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.page.evaluate(
        ({ disabled, enabled }) => {
          const counts = (window.__commandExecutionCounts ??= {})
          for (const [name, key] of [
            [disabled, 'j'],
            [enabled, 'k']
          ] as const) {
            const commandId = `${name}.Run`
            window.app!.registerExtension({
              name,
              keybindings: [{ combo: { key, alt: true }, commandId }],
              commands: [
                {
                  id: commandId,
                  function: () => {
                    counts[commandId] = (counts[commandId] ?? 0) + 1
                  }
                }
              ]
            })
          }
        },
        { disabled: DISABLED, enabled: ENABLED }
      )
      await comfyPage.canvas.click({ position: { x: 400, y: 400 } })
      await comfyPage.nextFrame()
    })

    test('a disabled extension adds no command and its shortcut does nothing', async ({
      comfyPage
    }) => {
      await comfyPage.canvas.press('Alt+KeyK')
      await expect
        .poll(() => comfyPage.command.getExecutionCount(`${ENABLED}.Run`))
        .toBe(1)

      await comfyPage.canvas.press('Alt+KeyJ')
      await comfyPage.nextFrame()
      expect(await comfyPage.command.getExecutionCount(`${DISABLED}.Run`)).toBe(
        0
      )

      const registered = await comfyPage.page.evaluate(
        (ids) =>
          ids.map((id) =>
            window.app!.extensionManager.command.commands.some(
              (command) => command.id === id
            )
          ),
        [`${DISABLED}.Run`, `${ENABLED}.Run`]
      )
      expect(registered).toEqual([false, true])
    })
  }
)
