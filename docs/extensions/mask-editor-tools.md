# MaskEditor tools

> **Proposed API — not released.** The contract-only review stage provides
> registration but does not activate tools or invoke session callbacks. The
> runtime/UI integration is reviewed separately; both stages require extension-API
> owner approval and must ship together. The active-session behavior below
> describes that proposed combined API. Extensions must wait for its release
> before depending on it.

Extensions can register an image selection tool through
`app.extensionManager.maskEditor.registerTool(tool)`. Check that `maskEditor`
exists before using the API on older frontend versions.

The frontend owns pointer routing, image coordinates, mask history, and Save.
The extension owns its tool UI, prompt state, and any inference service.
Registration does not add node widgets or change workflow serialization.

## Registration

```ts
const registration = app.extensionManager.maskEditor.registerTool({
  id: 'my-extension.selection',
  label: 'My selection tool',
  icon: 'icon-[lucide--crosshair]',
  createSession(editor) {
    return createSelectionSession(editor)
  }
})

if (registration.ok) {
  extensionCleanup.add(registration.unregister)
}
```

IDs must be nonempty and contain only letters, digits, underscores, periods,
or hyphens. Use an extension namespace. Duplicate IDs are rejected without
replacing the existing registration. `unregister()` is idempotent and closes
that registration's active session.

The result is `{ ok: true, unregister }` or
`{ ok: false, reason: 'invalid-tool' | 'duplicate-id' }`.
The optional icon is a CSS icon class; provide any required icon assets with
the extension. A puzzle icon is used when no icon is supplied.

## Active sessions

`createSession(context)` runs when the user selects the tool. It synchronously
returns a `MaskEditorToolSession` with optional callbacks. Promise-returning
factories are rejected and reported.

| Callback                     | Contract                                                                                                                                                                                                                                    |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `onPointer(event)`           | Receives down, move, up, and cancel events while active. Coordinates are floating point pixels in the current base image; `inBounds` identifies points outside it. Mouse button, pointer ID/type, pressure, and modifier keys are included. |
| `mountPanel(container)`      | Mounts tool controls into the settings panel. Return an unmount function to release listeners and framework resources.                                                                                                                      |
| `onDocumentChange(revision)` | Reports edits made outside this session, including native Undo/Redo and transforms. Reset or recompute prompts as appropriate.                                                                                                              |
| `dispose()`                  | Releases session resources when switching tools, unregistering, or closing the editor. Called once.                                                                                                                                         |

Middle-button and Space-drag panning, wheel zoom, and touch navigation remain
owned by the editor. An active extension does not also draw a native brush
stroke. Switching back to a native tool ends the extension session. Selecting
the extension again creates a fresh session.

Touch input is reserved for editor navigation and is not delivered to extensions.
For delivered events, `pointerType` preserves the browser's string value. Handle
`mouse` and `pen` when device-specific behavior is needed, and provide a default
for empty or vendor-specific values.

If an extension callback fails, the editor closes that session, cleans up its
panel, and reports the failure to the user. Native tools remain available.

`onPointer`, `onDocumentChange`, `dispose`, and the panel's unmount function
may return promises. Panel mounting itself remains synchronous; a promise or
another invalid cleanup value closes the session at mount time. Closing a
session aborts its signal and removes its panel immediately; asynchronous
cleanup does not delay tool switching. Callback failures from an obsolete
document are ignored. Cleanup failures are still reported, without closing a
new session. A failing session is reported once, even if its cleanup also fails.

Extension drags capture their pointer until release or cancellation, including
outside the pointer zone. Losing capture sends `cancel` once. Switching tools,
unregistering, or closing the editor releases outstanding captures and disposes
the session.

The panel is an extension-owned mount container, like a custom sidebar tab.
Bundle your own Vue/React dependencies if needed; do not import frontend
components or stores. Pointer markers are separate from panel contents.

## Image snapshots and inference

`context.readImage()` returns `{ image: ImageData, revision }`, or `undefined`
when the session is closed or the image is unavailable. The pixel buffer is a
copy of the current base image at full resolution, including rotations and
mirroring. It excludes the paint layer, mask, and tool overlays. Its coordinate
system is the same as pointer events. Encode or upload that snapshot using the
extension's own backend contract.

Each call copies the full-resolution pixel buffer. Read once when starting an
inference operation and reuse that snapshot within the operation; avoid reading
on every pointer event. If retaining snapshots across operations, invalidate them
on document changes and after a successful commit by the same session. That
commit advances the revision without invoking `onDocumentChange`.

Capture `context.signal` when starting asynchronous work. It is aborted on
external document changes and when the session ends. After a document change,
the getter returns a new signal for new work. Always handle cancellation and
use the snapshot revision when applying a result. Extensions that launch
overlapping requests should also cancel superseded requests themselves.

## Mask application

```ts
const snapshot = editor.readImage()
if (!snapshot) return

const signal = editor.signal
let mask: MaskEditorMask
try {
  mask = await inferMask(snapshot.image, prompts, { signal })
} catch (error) {
  if (!signal.aborted) showInferenceFailure(error)
  return
}
if (signal.aborted) return

const result = editor.commitMask(mask, {
  expectedRevision: snapshot.revision
})
if (!result.ok) showApplyFailure(result.reason)
```

`inferMask`, `showInferenceFailure`, and `showApplyFailure` above belong to the
extension. Cancellation returns quietly; other inference failures are reported
without applying a mask.
The mask is `{ width, height, data: Uint8Array }`, one byte per pixel in row-major
order. Zero is unselected, 255 is fully selected, and intermediate values are
partial selection. Dimensions must match the snapshot. The API replaces only
the mask layer and records one native Undo step. RGB and paint layers are
preserved. Normal Save performs alpha encoding and updates the source node.
Changes to the caller's mask buffer after a successful commit do not alter the
committed mask or its Undo/Redo history.

Success returns `{ ok: true, revision }`. Refusals return `{ ok: false, reason }`
where the reason is `inactive`, `unavailable`, `stale`, `invalid-mask`, `invalid-options`, or
`failed`. Validate the result before displaying success. A revision never
returns to an earlier value after Undo, Redo, or history eviction.

The session's own successful mask commit keeps its markers and does not invoke
`onDocumentChange`. Native Undo/Redo of that commit does invoke the callback.
An extension's “remove last prompt point” action is separate from mask Undo.

## Point overlays

`context.setOverlay(points)` replaces this session's markers. Each marker is
`{ id, x, y, radius, color }`; coordinates and radius are in image pixels.
Use unique IDs and valid CSS colors. The frontend scales and moves markers
with the image, and excludes them from snapshots, mask history, and Save.

Overlays clear on external document changes and session disposal. The method
returns `false` for a closed session, invalid coordinates/radii, non-string
IDs/colors, or duplicate IDs. Calls from a closed session cannot affect a
later editor.

Public TypeScript contracts are exported from the frontend types entry point
as `MaskEditorExtensionAPI`, `MaskEditorTool`, `MaskEditorToolContext`, `MaskEditorToolSession`,
`MaskEditorPointerEvent`, `MaskEditorImageSnapshot`, `MaskEditorOverlayPoint`,
`MaskEditorMask`, `MaskEditorCommitResult`, and `MaskEditorToolRegistration`.
