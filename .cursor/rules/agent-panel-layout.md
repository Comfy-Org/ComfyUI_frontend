---
description: Agent chat panel layout rule — always full viewport height, never nested under the header bar
globs:
  - src/components/LiteGraphCanvasSplitterOverlay.vue
  - src/platform/agent/**
alwaysApply: true
---

# Agent Panel Layout

The Comfy Agent chat panel must always span the **full viewport height** — from the very top of the screen to the bottom, alongside the header bar and canvas, not below them.

## Correct structure

`LiteGraphCanvasSplitterOverlay` uses a top-level **`flex-row`** so the agent panel is a sibling of the entire left column (tabs + canvas), not a child inside it:

```
div.flex-row (viewport)
├── div.flex-col.flex-1          ← left side: everything else
│   ├── slot#workflow-tabs       ← header bar
│   └── div.flex-1               ← canvas + sidebar panels
└── div.shrink-0 (agent panel)   ← RIGHT: full viewport height
```

## Rules

- **Never** place the agent panel inside the `div` that sits below `slot#workflow-tabs`. That causes the panel to start below the header bar.
- The agent panel div must be a **direct child** of the outermost `div.flex-row` container in `LiteGraphCanvasSplitterOverlay.vue`.
- The left side (`flex-1 flex-col`) wraps both `slot#workflow-tabs` AND the canvas/splitter row.
- The agent panel has `h-full` and `shrink-0` so it fills the full height and does not flex-shrink.
