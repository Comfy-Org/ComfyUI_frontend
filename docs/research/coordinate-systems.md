# Research: Canvas vs Client/Pixel Coordinate Usage

Date: 2026-05-12

## Question

How should the extension API handle coordinate systems? Should it expose canvas coordinates, screen/client coordinates, or both?

## Coordinate Systems in ComfyUI

### 1. Canvas Space (Logical Units)

Node positions and sizes are in canvas logical units:

- Independent of zoom/pan
- `[0, 0]` is the canvas origin
- Moving a node to `[100, 200]` places it at canvas position (100, 200) regardless of viewport state

### 2. Screen/Client Space (Pixels)

DOM elements use pixel coordinates relative to the viewport:

- Affected by zoom/pan/scroll
- `clientX`/`clientY` from mouse events
- `getBoundingClientRect()` returns pixel values

### 3. Widget Height (Pixels)

DOM widgets reserve height in pixels:

```ts
addDOMWidget({ name: 'preview', element: img, height: 200 }) // 200px
```

## Current Extension API

| Method                     | Coordinate System | Notes                                     |
| -------------------------- | ----------------- | ----------------------------------------- |
| `getPosition()`            | Canvas            | Returns `[x, y]` in canvas units          |
| `setPosition()`            | Canvas            | Accepts `[x, y]` in canvas units          |
| `getSize()`                | Canvas            | Returns `[width, height]` in canvas units |
| `setSize()`                | Canvas            | Accepts `[width, height]` in canvas units |
| `addDOMWidget({ height })` | Pixels            | Reserved height in pixels                 |
| `widget.setHeight(px)`     | Pixels            | Widget height in pixels                   |

## Analysis

### When Extensions Need Canvas Coordinates

1. **Node positioning**: Placing nodes relative to each other
2. **Layout algorithms**: Auto-arranging nodes in a pattern
3. **Collision detection**: Checking if nodes overlap

### When Extensions Need Screen Coordinates

1. **Custom overlays**: Drawing UI at a specific screen location
2. **Drag-and-drop from external sources**: Converting mouse position to canvas position
3. **Context menus**: Positioning menus near the cursor

### Current State

The extension API currently exposes:

- **Canvas coordinates** for node position/size — appropriate, as these are logical values
- **Pixel values** for DOM widget height — appropriate, as these are DOM measurements

**Missing**: No conversion helpers between canvas and screen coordinates.

## Recommendation

**The current approach is appropriate.** Extensions that manipulate node positions should work in canvas space. This is the natural abstraction — extensions shouldn't need to account for zoom/pan when laying out nodes.

### For Advanced Cases

Extensions needing coordinate conversion (e.g., custom overlays) should either:

1. **Use LiteGraph's existing transform utilities** (available on `app.canvas`)
2. **Access the transform state** via a future canvas API (not part of node/widget handles)

### Why Not Expose Conversion Helpers on NodeHandle?

- **Wrong abstraction level**: Coordinate conversion is a canvas concern, not a node concern
- **State dependency**: Conversion requires current zoom/pan state, which changes frequently
- **Rare use case**: Most extensions work entirely in canvas space

## Future Considerations

If multiple extensions need coordinate conversion, consider:

1. **Canvas API**: `canvas.screenToCanvas(point)` / `canvas.canvasToScreen(point)`
2. **Events with both coordinates**: `positionChanged` could include both canvas and screen positions

For now, no changes are needed — the current API serves the common cases well.
