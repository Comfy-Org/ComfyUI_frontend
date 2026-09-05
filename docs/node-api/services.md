# Application services

The root API exposes narrow services for behavior that legitimately belongs
outside one node: settings, commands, host UI contributions, backend calls,
workflow loading, and per-user storage.

## Settings

Declare a setting once at module load:

```js
comfy.settings.declare({
  id: 'MyPack.previewQuality',
  name: 'Preview quality',
  type: 'slider',
  defaultValue: 80,
  category: ['My Pack', 'Preview'],
  attrs: { min: 1, max: 100, step: 1 },
  onChange(value, previous) {
    rebuildPreview(value, previous)
  }
})
```

Setting IDs share one namespace with core and every pack. Include a stable pack
prefix. Redeclaring an ID does not reset an existing user's value.

Supported controls are:

- `boolean`, `number`, `slider`, and `knob`;
- `combo` and `radio`;
- `text`, `password`, `color`, `image`, and `url`.

For combo and radio choices, a string is both stored value and label. Use
`{ value, label }` when they differ so numeric values remain numeric.

Read, write, and observe settings:

```js
const quality = comfy.settings.get('MyPack.previewQuality')
await comfy.settings.set('MyPack.previewQuality', 90)

const stop = comfy.settings.onChange(
  'Comfy.LinkRelease.Action',
  (value, previous) => respondToCoreSetting(value, previous)
)
```

`onChange()` can observe a setting the pack did not declare. It fires on change,
not on registration.

Settings are small preferences. Use `comfy.storage` for named content the user
authors.

## Commands, keybindings, and notifications

```js
comfy.commands.register({
  id: 'MyPack.centerPrimary',
  label: () => `Center ${primaryLabel()}`,
  keybinding: { key: 'm', ctrl: true, shift: true },
  scope: 'canvas',
  run() {
    const node = findPrimaryNode()
    if (node) comfy.graph.centerOn(node)
  }
})
```

Command IDs must be namespaced. A label may be dynamic and should return
quickly. A keybinding is a default so a user's custom binding wins.

`scope: 'canvas'` prevents the keybinding from firing while the user is typing
in a node widget or another field. Omit it for an application-wide command.

Run a host or pack command without reaching into its implementation:

```js
if (comfy.commands.has('Comfy.MaskEditor.OpenMaskEditor')) {
  await comfy.commands.run('Comfy.MaskEditor.OpenMaskEditor')
}
```

`run()` rejects when the command does not exist. Use `has()` for an optional
entry.

Show a notification:

```js
comfy.commands.notify({
  severity: 'warn',
  summary: 'Model unavailable',
  detail: 'Refresh node definitions after installing it.',
  life: 5000
})
```

Severity is `success`, `info`, `warn`, or `error` and defaults to `info`.

## Sidebar tabs

Hand-written modules can render into a host container:

```js
const removeTab = comfy.ui.addSidebarTab({
  id: 'MyPack.assets',
  title: 'My assets',
  icon: 'icon-[lucide--folder]',
  render(container) {
    mountAssetBrowser(container)
  },
  destroy() {
    unmountAssetBrowser()
  }
})
```

`render()` can run each time the tab becomes visible. Treat it as a mount and
release retained resources from `destroy()`.

A built pack can instead provide a bundled Vue component:

```js
comfy.ui.addSidebarTab({
  id: 'MyPack.monitor',
  title: 'Monitor',
  component: MonitorTab
})
```

Per ADR 0005, a pack bundles its own Vue. Do not import the host's internal Vue
runtime or pass host reactive objects across the boundary.

## Top-bar badges and action buttons

These contributions are declarative so the host retains control of layout and
style:

```js
const badge = comfy.ui.addTopBarBadge({
  id: 'MyPack.queueState',
  text: 'Idle',
  variant: 'info',
  tooltip: 'My Pack queue state'
})

badge.update({ text: 'Running', variant: 'warning' })
badge.remove()
```

```js
const button = comfy.ui.addActionBarButton({
  id: 'MyPack.openPanel',
  icon: 'icon-[lucide--panel-right-open]',
  label: 'Open My Pack',
  run(event) {
    openPanel({ detached: event.shiftKey })
  }
})
```

IDs must be namespaced and unique. An update changes only supplied fields. A
removed contribution cannot be updated again.

If an action also needs a palette entry or shortcut, put behavior in a command
and have the button call `comfy.commands.run()`.

## Dialogs, menus, and prompts

### Dialog

```js
const dialog = comfy.ui.showDialog({
  key: 'MyPack.modelInfo',
  title: 'Model information',
  render(container) {
    renderModelInfo(container)
  },
  destroy() {
    releaseModelInfo()
  }
})

dialog.close()
```

Dialogs also accept a bundled Vue `component` and optional frozen `props`.
Dialog keys must be namespaced because the host maps them into one dialog
keyspace.

### Context menu raised by a pack

```js
const menu = comfy.ui.showMenu({
  title: 'Output type',
  event: mouseEvent,
  items: [
    { label: 'Image', run: () => choose('IMAGE') },
    {
      label: 'Latent',
      submenu: [
        { label: 'Samples', run: () => choose('LATENT') },
        { label: 'Noise', disabled: true }
      ]
    }
  ]
})
```

The `MouseEvent` positions the menu. A submenu item is mutually exclusive with
`run`. Use `NodeDefBuilder.addMenuItem()` instead when the host is opening a
node's own context menu.

### Prompt

```js
const label = await comfy.ui.prompt({
  label: 'Group name',
  value: group.getTitle(),
  placeholder: 'Name'
})
```

The result is `undefined` when the user cancels.

## Backend URLs, requests, and events

### Authenticated API calls

```js
const response = await comfy.backend.fetch('/my-pack/models', {
  method: 'GET'
})
```

`fetch()` delegates credentials and authentication behavior to the host. Its
route is API-relative and must start with `/`.

`backend.url(route)` builds the absolute API URL but does not attach credentials
to a later plain `fetch()`. Prefer `backend.fetch()` for API requests.

### Static host files

```js
const url = comfy.backend.assetUrl('/extensions/shared/icon.svg')
```

`assetUrl()` does not add the API prefix. For a file next to the current pack's
module, use the install-location-safe form:

```js
const stylesheet = new URL('./panel.css', import.meta.url)
```

Do not guess the pack's install directory.

### Backend messages and session identity

```js
const stop = comfy.backend.on('my-pack-progress', (detail) => {
  updateProgress(detail)
})

const session = comfy.backend.sessionId()
```

Event payloads are `unknown` because a pack owns its own event schema. Validate
before use. The session ID can be `undefined` until the backend connection is
established and must not be persisted.

## System monitoring

Read one validated hardware snapshot from the host:

```js
const snapshot = await comfy.system.monitor()
console.log(snapshot.memory.available)
```

The snapshot contains CPU utilization, total and available memory, mounted
volumes, and accelerators. Unsupported utilization and temperature sensors are
`null`. Treat volume and accelerator IDs as opaque; they identify entries only
within the returned host data.

## Workflow service

Open parsed ComfyUI workflow JSON as the active document:

```js
const data = JSON.parse(text)
await comfy.workflow.open(data)
```

This replaces the current document and is therefore an explicit user-facing
action. Validate or confirm untrusted input before calling it.

Expand the host's workflow text tokens against the active root graph:

```js
const filename = comfy.workflow.applyTextReplacements(
  '%date:yyyy-MM-dd%_%KSampler.seed%'
)
```

It throws when no graph is active.

## Per-user storage

Storage is for named text documents such as presets, templates, and saved
prompts:

```js
await comfy.storage.set('MyPack.presets/portrait', JSON.stringify(preset))

const text = await comfy.storage.get('MyPack.presets/portrait')
const names = await comfy.storage.list('MyPack.presets')

await comfy.storage.remove('MyPack.presets/portrait')
```

Names and namespaces must contain a pack prefix and may not contain `..`.
`get()` returns `undefined` for a missing item; `list()` returns an empty frozen
array when the namespace has no entries.

Storage lives with the user's server-side data and follows the user between
machines. Use settings for small preferences, and storage for content the user
expects to retain and manage by name.
