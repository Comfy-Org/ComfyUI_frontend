# Keyboard shortcuts after capture dispatch

The frontend resolves keyboard commands on `window` in the capture phase.
Register shortcut actions through `app.registerExtension` so users can remap
them and the dispatcher can apply dialog, focus and source priority consistently.

```ts
app.registerExtension({
  name: 'Example.Navigation',
  contextKeys: ['active'],
  commands: [{ id: 'Example.Next', function: () => nextItem() }],
  keybindings: [
    {
      commandId: 'Example.Next',
      combo: { key: 'ArrowRight' },
      when: 'Example.Navigation.active',
      allowRepeat: true
    }
  ]
})
app.extensionManager.contextKey.set('Example.Navigation.active', true)
```

Set the context to false when the surface closes. A clause is a conjunction
such as `key && !otherKey`; register separate bindings for alternatives.
Unknown context keys fail closed, including negated keys. An extension's
bindings outrank core defaults, and a user's bindings outrank both. Exact
conflicts within one source tier are rejected with attributable feedback.

Use `dialogKey` for a dialog opened through `dialogStore`; it is eligible only
while that dialog is active. A workspace binding is blocked by an open modal
unless it explicitly requires `modalOpen`. Text-editing keys stay inside inputs;
extensions cannot opt those keys out of input controls. Users can explicitly
bind an extension command there with a `textInputFocus` condition.

A held action supplies a second registered command as `releaseCommandId`.
Release runs once on keyup, blur, visibility loss or invalidated ownership,
using the provider that handled the original press. Keep release safe after
its surface has closed. `allowRepeat: false` suppresses repeated execution;
`preventDefault: false` lets an intentional browser default accompany an action.

Internal Vue components use `useKeybinding` from
`src/platform/keybindings/useKeybinding.ts`. It keeps command identity and
customizations across remounts and cleans up active callbacks. Non-component
owners call `useRuntimeKeybindingStore().register` and dispose the returned
registration with their own lifecycle.

`LGraphCanvas.processKey` remains available for compatibility wrappers. It no
longer dispatches built-in canvas shortcuts or calls `graph.change()` for every
key. Selected-node `onKeyDown`/`onKeyUp` callbacks receive unclaimed events.
Code that performs a graph mutation must announce that mutation/redraw itself.
Window/element listeners still observe claimed events: check
`event.defaultPrevented` before performing another action. A later
`stopPropagation()` cannot undo an action already dispatched during capture.

Native controls keep their own text editing, activation and menu navigation.
An embedded editor that owns its entire keyboard interaction can mark its root
with `data-comfy-keybinding-ignore`; the dispatcher checks the composed path,
including shadow roots. Avoid this boundary for ordinary command shortcuts,
which should remain visible and configurable in the shortcuts panel.

`Comfy.Keybinding.SettingsV1` is the authoritative persisted configuration.
Legacy settings are a compatibility mirror; do not write them to customize
new scoped or held bindings. Presets preserve all binding fields.

For a capture-ordering regression, set the hidden
`Comfy.Keybinding.CapturePhase` setting to `false` through the settings API.
It switches the existing dispatcher to the bubble phase immediately and releases
held actions. Report the failing command and extension/version; command and
context failures already use the shared telemetry sink without recording keys.
