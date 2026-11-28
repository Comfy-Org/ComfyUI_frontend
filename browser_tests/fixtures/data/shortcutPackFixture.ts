export const DISABLED_SHORTCUT_EXTENSION = 'Test.DisabledShortcutPack'
export const ENABLED_SHORTCUT_EXTENSION = 'Test.EnabledShortcutPack'
export const SHORTCUT_PACK_SCRIPT = '/extensions/shortcut-pack/main.js'

/** Pack script registering two extensions with Alt+J / Alt+K; a run stamps `body[data-ran-shortcut]`. */
export const shortcutPackSource = `
import { app } from '../../scripts/app.js'

for (const [name, key] of [
  ['${DISABLED_SHORTCUT_EXTENSION}', 'j'],
  ['${ENABLED_SHORTCUT_EXTENSION}', 'k']
]) {
  app.registerExtension({
    name,
    commands: [
      {
        id: name + '.Run',
        label: name + ' run',
        function: () => {
          document.body.dataset.ranShortcut = name
        }
      }
    ],
    keybindings: [{ combo: { key, alt: true }, commandId: name + '.Run' }]
  })
}
`
