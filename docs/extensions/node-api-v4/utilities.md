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

A declaration lasts for the page, and an id already declared throws. Every
settings member throws a `TypeError` for an id every object inherits, such as
`__proto__`, `constructor` or `toString`, and so does `commands.register`. `set`
returns the settings store's promise: it rejects when the server cannot be
reached and resolves when the server answers, even with a refusal, and in both
cases the value stays applied until the next reload (core issue #23467).

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

V4 has two versions, one for each half. The frontend's is the module you
import: `comfy.getApiVersion()` and `comfy.isApiVersionAtLeast`. The
backend's is what `comfy.backend.getApiVersion()` resolves, once the server
has sent its feature flags: a version such as `4.0.0`, or `undefined` when
the ComfyUI it runs on has no V4. Check it before relying on V4 Python nodes:

```ts
import { comfy } from '/comfy/api/v4.js'

const backendV4 = await comfy.backend.getApiVersion()
if (backendV4 === undefined) {
  comfy.commands.notify({
    severity: 'warn',
    summary: 'MyPack needs a ComfyUI with the V4 node API'
  })
}
```

Two rules hold for the events a pack's Python sends with `ui.send` and its
frontend hears with `comfy.backend.on`:

- Name the event `<pack>.<event>`, such as `mypack.progress`. The backend
  refuses to send one of the message types the frontend acts on itself, such
  as `progress` or `executed`.
- Subscribe before Python sends it. The frontend drops a message no listener
  has asked for, so call `comfy.backend.on` when the pack loads, not when the
  first message is expected.

## System readings

`comfy.system.monitor()` reads what the backend's `/system_stats` reports: the
RAM, and each GPU's VRAM, in bytes. CPU load, GPU load, temperature and disks
are not available from the backend. A machine with no GPU has no
accelerators. It resolves `undefined` when the backend cannot be read.

```ts
import { comfy } from '/comfy/api/v4.js'

const snapshot = await comfy.system.monitor()
if (snapshot) {
  const { total, available } = snapshot.memory
  console.info(`RAM ${Math.round((100 * (total - available)) / total)}% used`)
  for (const gpu of snapshot.accelerators)
    console.info(gpu.name, gpu.memoryTotal - gpu.memoryAvailable, 'bytes used')
}
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

### Panels and overlays over the graph

`mountViewportPanel` returns a disposer at once, also in the module body
before the app has a graph view. The panel renders once, when it joins the
graph view. It has no `destroy`: the pack tears its own content down, then
calls the disposer, which takes the panel off. A panel sits above every graph
overlay, so a press on it does not reach an interactive overlay.

```ts
import { comfy } from '/comfy/api/v4.js'

let stopTidy: (() => void) | undefined
const removePanel = comfy.ui.mountViewportPanel({
  id: 'MyPack.toolbar',
  ariaLabel: 'My pack tools',
  anchor: 'top-right',
  offsetY: 8,
  render(container) {
    const button = document.createElement('button')
    button.textContent = 'Tidy'
    const tidy = () => void comfy.commands.run('MyPack.tidy')
    button.addEventListener('click', tidy)
    container.append(button)
    stopTidy = () => button.removeEventListener('click', tidy)
  }
})

function closePanel() {
  stopTidy?.()
  removePanel()
}
comfy.onReady(() => console.info(typeof closePanel))
```

Browser features that V2 offered through a guest SDK (`files`, `clipboard`,
`media`, `crypto`, `element`) are not part of the API: use the browser's own
APIs, as listed in [Converting a V2 pack](./v2-to-v4.md#guest-sdk-members).
