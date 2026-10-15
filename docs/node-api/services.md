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

Per ADR-EXTENSIONS-PUBLIC-API-0005, a pack bundles its own Vue. Do not import
the host's internal Vue runtime or pass host reactive objects across the
boundary.

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

## Pack-relative backend requests and events

### Calling this pack's declared endpoints

```js
const response = await comfy.backend.fetch('presets', {
  method: 'GET'
})
```

`backend.fetch()` and `backend.ownFetch()` call only endpoints declared by the
calling Secure Nodes pack. New code uses relative endpoint paths, with no
leading slash, empty or dot segments, percent-encoded path, scheme, authority,
backslash, fragment, or control character. Invalid paths are rejected rather
than decoded or normalized. Query values are re-encoded by the host.

The host assigns the route base from trusted pack identity and constructs
`/ext/<assigned-base>/<relative-path>` internally. The namespace is stable across
pack revisions and restarts; it is not an authorization secret. Pack code must
not choose a base. The host attaches authentication only after
validating the pack-relative request; a pack cannot select core routes,
another pack's endpoints, or an external server.

Backend declarations use the same relative path in `secure-nodes.json`:

```json
{
  "routes": [
    {
      "method": "get",
      "path": "presets",
      "module": "_secure_routes",
      "handler": "list_presets",
      "permissions": ["storage"]
    }
  ]
}
```

The runtime mounts declarations beneath the system-assigned base and checks
the declared method and endpoint. A pack with no declared routes has no endpoint
to call. Bodies remain bounded data; credentials and server request objects stay
in the host.

Legacy URL builders (`backend.url()`, `ownUrl()`, and `assetUrl()`) are not a
supported pack API. Trusted-host adapters retained in declarations are
deprecated for pack use. Do not construct `/ext/` URLs or use a plain fetch to
bypass the host broker.

The interim runtime accepts an older `ownFetch()` request carrying the exact
calling pack's `/ext/<assigned-base>/` prefix, then strips and rebuilds it under
the host's grant. It also normalizes one legacy leading slash in backend route
declarations with a deprecation warning. These compatibility forms cannot
address another namespace; new pack code uses relative paths.

### Shared capabilities = named async API methods

Shared/core operations use named async methods on `comfy.*`, with typed inputs,
bounded results, host validation, and a declared capability where required.
For example, `await comfy.system.monitor()` reads a validated snapshot and
`await comfy.queue.interrupt()` interrupts execution. Queue status has the
local `comfy.queue.pending()` snapshot and `onPendingChanged()` subscription.

Model listing uses `comfy.models.list(folder)`. Image view/upload and other
shared operations require their
published named capabilities. If the current declaration lacks the needed
method, report an API gap with the intended behavior and bounds. Do not fetch
`/userdata`, `/settings`, `/internal`, `/queue`, `/view`, `/upload`, or another
pack's routes. Proposed methods are unavailable until implemented and published.

### Model catalogues

```js
const names = await comfy.models.list('loras')
```

`models.list(folder)` returns distinct logical model names, including logical
subfolder names. It exposes no filesystem locations or library path indexes.
`ModelFolder` is closed: `checkpoints`, `clip`, `clip_vision`, `controlnet`,
`diffusion_models`, `embeddings`, `loras`, `text_encoders`, `unet`,
`upscale_models`, `vae`, `ipadapter`, and `vae_approx`. Unknown folders reject;
a pack cannot supply a URL or extend that list by passing a string.

The host selects the model-library route and falls back to the plain-ComfyUI
catalogue only on HTTP 404. Other HTTP failures and malformed replies reject.
At most 50,000 names of 1,024 characters are admitted, without control characters,
absolute/drive paths or traversal. The secure broker shares concurrent requests,
reuses results for two seconds and allows at most 20 listing starts per ten
seconds per calling pack. These broker checks also apply when a frontend model
service handles the request. Model listing does not grant model loading or other
proposed model operations.

### Bundled files

For an admitted file next to the pack module, use a module-relative URL:

```js
const stylesheet = new URL('./panel.css', import.meta.url)
```

The host serves admitted bundled assets. This does not grant a backend route;
do not guess the pack's install directory or route base.

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

Names and namespaces are logical keys within the host-selected user/pack scope.
Keep a dotted prefix for grouping and do not include `..`. Choosing another
pack's name does not select its data: the host adds the physical namespace from
trusted identity and returns only logical names. The same key used by two packs
is isolated. A pack never supplies a user identity or physical storage prefix.

Secure Nodes hosts that have not implemented this isolation reject pack storage
RPCs. A dotted key alone does not make shared user data safe to expose.

`get()` returns `undefined` for a missing item; `list()` returns an empty frozen
array when the namespace has no entries.

The configured host storage backend owns persistence and cross-machine
availability. Use settings for small preferences, and storage for content the
user expects to retain and manage by name.
