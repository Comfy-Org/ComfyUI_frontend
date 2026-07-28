# Hero graph

An interactive recreation of a ComfyUI camera-angle flow, used as the comfy.org
landing hero. Three elements are wired left to right:

```
input image ──▶ 3D ANGLE node ──▶ OUTPUT image
```

The **3D ANGLE** node is a real Three.js scene (a white orbit ring, a grey
elevation handle, a yellow camera indicator and zoom handle) that the visitor
drags directly. As the camera pose changes, the OUTPUT image cross-fades to the
matching pre-rendered result and the live prompt "words" below the graph update
— no Run button, it just changes.

## The "no backend" illusion

There is no inference. We ship a set of pre-rendered images, one per camera
pose. The camera state (azimuth / elevation / zoom) resolves to a pose key, and
`resolveAsset` returns the closest shipped image. Elevation and distance degrade
to the nearest shipped label; azimuth snaps circularly. The resolver can never
return an empty state — see `assetResolver.ts` and its tests.

## Adding angle assets

1. Drop the source render into `apps/website/design/reference/renders/`, named
   with its pose slug: `{azimuth}__{elevation}__{distance}.png`, e.g.
   `right-side-view__eye-level-shot__medium-shot.png`. Use the exact label
   vocabulary from `cameraVocabulary.ts` (`AZIMUTH_LABELS`, `ELEVATION_LABELS`,
   `DISTANCE_LABELS`), spaces replaced with hyphens. Source PNGs are gitignored;
   only the optimized output is committed.
2. Convert to WebP under `public/hero/angles/` at the same slug.
3. Add the pose to `ANGLE_ASSETS` in `assetResolver.ts`. The data structure
   already covers the full 8 × 4 × 3 grid, so the resolver picks it up with no
   other change.

The v1 set covers a sparse subset; poses without an exact asset snap to the
nearest neighbour, so filling in the ring makes the interaction feel denser
without any code change.

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
