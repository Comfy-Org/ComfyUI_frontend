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

The shipped set is six 360° turntable rings, each extracted from a single
orbit video of the same scene and encoded as native-4:3 WebPs: three 16-frame
eye-level orbits (22.5° steps) and three 10-frame elevated orbits (36° steps),
one per distance (wide shot, medium shot, close-up). Zooming the camera swaps
distance rings; raising it swaps elevation bands. Frames are named by
turntable azimuth plus the label vocabulary from `cameraVocabulary.ts`:
`az{degrees}__{elevation}__{distance}.webp`, e.g.
`az022-5__eye-level-shot__medium-shot.webp` (degrees use `-5` for half steps).
Each ring is phased so azimuth 0 reproduces the input image's viewpoint, and
all rings orbit the same direction.

To add further elevation bands (top/bottom views): convert the frames to WebP
under `public/hero/angles/` at the matching slugs and add a `RingSpec` to
`RINGS` in `assetResolver.ts`. The resolver matches the pose's elevation band
first, then its distance band, then snaps azimuth circularly — so scrubbing
azimuth never hops between rings, and bands without a shipped ring degrade to
the nearest one.

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
