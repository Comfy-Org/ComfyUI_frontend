# Settings, storage, commands, backend and UI

## Settings

```ts
import { comfy } from '/comfy/api/v4.js'

comfy.settings.declare({
  id: 'MyPack.previewSize',
  name: 'Preview size',
  type: 'slider',
  defaultValue: 256,
  attrs: { min: 64, max: 1024, step: 64 }
})
const size = comfy.settings.get('MyPack.previewSize')
comfy.settings.onChange('MyPack.previewSize', (value) => console.info(value))
await comfy.settings.set(
  'MyPack.previewSize',
  typeof size === 'number' ? size * 2 : 256
)
```

A declaration lasts for the page, and an id already declared throws.

## Per-user storage

Text the pack keeps in the user's data on the server, under a relative path.

```ts
import { comfy } from '/comfy/api/v4.js'

const stored = await comfy.storage.get('MyPack/presets.json')
if (!stored.ok) console.warn('could not read presets')
else if (stored.text === undefined)
  await comfy.storage.set('MyPack/presets.json', '[]')
console.info(await comfy.storage.list('MyPack'))
```

## Commands and notifications

```ts
import { comfy } from '/comfy/api/v4.js'

const gotKey = comfy.commands.register({
  id: 'MyPack.tidy',
  label: 'Tidy the graph',
  keybinding: { key: 't', alt: true },
  scope: 'canvas',
  run: () =>
    comfy.commands.notify({
      severity: 'success',
      summary: 'Tidied',
      life: 3000
    })
})
if (!gotKey) console.info('another command holds Alt+T')
await comfy.commands.run('MyPack.tidy')
```

## Backend

Routes start with one `/` and follow the editor's base path.

```ts
import { comfy } from '/comfy/api/v4.js'

const response = await comfy.backend.fetch('/mypack/status')
if (response.ok) console.info(await response.json())
const icon = comfy.backend.assetUrl('/extensions/MyPack/icon.png')
const image = comfy.backend.url('/view?filename=a.png&type=output')
comfy.backend.on('mypack.progress', (detail) =>
  console.info(detail, icon, image)
)
const loras = await comfy.models.list('loras')
console.info(loras?.length ?? 'the server did not list them')
```

## UI

The pack renders content into the element it is given, with its own tools,
and cleans up in `destroy`.

```ts
import { comfy } from '/comfy/api/v4.js'

const removeTab = comfy.ui.addSidebarTab({
  id: 'MyPack.assets',
  title: 'Assets',
  icon: 'icon-[lucide--folder]',
  render(container) {
    container.textContent = 'My assets'
  }
})

const button = comfy.ui.addActionBarButton({
  id: 'MyPack.open',
  icon: 'icon-[lucide--camera]',
  tooltip: 'Open the pack',
  run: () => {
    const dialog = comfy.ui.showDialog({
      key: 'MyPack.main',
      title: 'My pack',
      render(container) {
        container.textContent = 'Hello'
      }
    })
    setTimeout(() => dialog.close(), 5000)
  }
})

const name = await comfy.ui.prompt({ label: 'Name', value: 'untitled' })
if (name !== undefined) button.update({ tooltip: `Open ${name}` })
removeTab()
```

Browser features that V2 offered through a guest SDK (`files`, `clipboard`,
`media`, `crypto`, `element`) are not part of the API: use the browser's own
APIs, as listed in [Converting a V2 pack](./v2-to-v4.md#guest-sdk-members).
