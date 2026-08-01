# Hero graph

An interactive recreation of a ComfyUI camera-angle flow, used as the comfy.org
landing hero. Three elements are wired left to right:

```
input image ──▶ 3D ANGLE node ──▶ OUTPUT image
```

The **3D ANGLE** node is a real Three.js scene (a white orbit ring, a grey
elevation handle, a yellow camera indicator and zoom handle) that the visitor
drags directly. As the camera pose changes, the OUTPUT image swaps to the
matching pre-rendered result and the live prompt "words" below the graph update
— no Run button, it just changes.

## Idle self-demo

If the visitor hasn't touched the graph shortly after it comes on screen, it
demonstrates itself exactly once: a single full orbit that returns to the pose
it started from, then stops for good. Interacting at any point — before or
during the demo — cancels it permanently; it never wrestles the visitor for
the controls.

`idleAutoplay.ts` holds the motion curve as a pure step function (tested
directly); `useIdleAutoplay.ts` wires it to interaction detection and a rAF
loop. It runs only while the graph is actually on screen, which also keeps the
desktop and mobile copies — both always mounted, one hidden by CSS — from
animating at once. `prefers-reduced-motion: reduce` disables it entirely.

## The "no backend" illusion

There is no inference. We ship a set of pre-rendered images, one per camera
pose. The camera state (azimuth / elevation / zoom) resolves to a pose key, and
`resolveAsset` returns the closest shipped image. Elevation and distance degrade
to the nearest shipped label; azimuth snaps circularly. The resolver can never
return an empty state — see `assetResolver.ts` and its tests.

## Adding angle assets

The shipped set is three uniform 16-frame 360° turntables (22.5° steps)
rendered at eye level — one per distance (wide shot, medium shot, close-up),
each extracted from a single orbit video of the same scene. Zooming the camera
swaps between the rings. Frames are named by turntable azimuth plus the label
vocabulary from `cameraVocabulary.ts`: `az{degrees}__{elevation}__{distance}.webp`,
e.g. `az022-5__eye-level-shot__medium-shot.webp` (degrees use `-5` for half
steps). The source frames are 4:3; each WebP is composed onto the cards'
1392×752 canvas by mirror-extending and blurring the frame's own background,
with the sharp centre feathered over it.

To add elevation variants (top/bottom views) later: convert to WebP under
`public/hero/angles/` at the matching slug and add the pose to `ANGLE_ASSETS`
in `assetResolver.ts`. The resolver scores azimuth first (circular, in
degrees), then elevation, then distance, so new variants slot in with no other
change; poses without an exact asset snap to the nearest shipped frame.

## Vendored code

`camera/CameraWidget.ts` is vendored from
[jtydhr88/ComfyUI-qwenmultiangle](https://github.com/jtydhr88/ComfyUI-qwenmultiangle)
(MIT). See `camera/ATTRIBUTION.md` for the license and local modifications
(named `three` imports, hardened disposal, pause/resume, and the optional
`palette` used to recolour the scene).

## Performance & accessibility

- The graph is server-rendered DOM; only the 3D scene needs JS.
- `three` and `CameraWidget` are dynamically imported and only initialise when
  the node scrolls into view and the main thread is idle. The render loop pauses
  when the tab is hidden or the node scrolls offscreen, and disposes the WebGL
  context, geometries, materials, and textures on unmount.
- The canvas is decorative; every camera axis is also a real, labelled
  `<input type="range">` (visually hidden) with `aria-valuetext` set to the pose
  label, so the flow is keyboard operable.
- Below `md` the WebGL scene is dropped for a static fallback image plus the
  live prompt words.
