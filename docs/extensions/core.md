# Core Extensions

This directory contains the core extensions that provide essential functionality to the ComfyUI frontend.

## Table of Contents

- [Overview](#overview)
- [Extension Architecture](#extension-architecture)
- [Core Extensions](#core-extensions)
- [Extension Development](#extension-development)
- [Extension Hooks](#extension-hooks)
- [Per-Workflow Graphs: Troubleshooting](#per-workflow-graphs-troubleshooting)
- [Further Reading](#further-reading)

## Overview

Extensions in ComfyUI are modular JavaScript modules that extend and enhance the functionality of the frontend. The extensions in this directory are considered "core" as they provide fundamental features that are built into ComfyUI by default.

## Extension Architecture

ComfyUI's extension system follows these key principles:

1. **Registration-based:** Custom extensions register themselves with `app.registerExtension()`; core extensions are registered by `registerCoreExtensions()`
2. **Hook-driven:** Extensions interact with the system through predefined hooks
3. **Non-intrusive:** Extensions should avoid directly modifying core objects where possible

## Core Extensions List

Core extensions live in `src/extensions/core/`. Each module exports its
extension object and registers nothing when imported. `registerCoreExtensions()`
in `index.ts` registers them from an explicit ordered list and decides which
ones load — some are unconditional, some are gated on the build distribution,
and the 3D stack is deferred behind a lazy loader. Two modules export a
registration function instead of an object: `electronAdapter.ts` and
`agentPanel.ts`. `load3dLazy.ts` registers the 3D extensions from its own list
when the first 3D node appears. The tables below follow that grouping.

### Always Loaded

| Extension               | Registered name                                               | Description                                           | Category |
| ----------------------- | ------------------------------------------------------------- | ----------------------------------------------------- | -------- |
| clipspace.ts            | `Comfy.Clipspace`                                             | Clipspace feature for passing images between nodes    | Image    |
| contextMenuFilter.ts    | `Comfy.ContextMenuFilter`                                     | Filter box for long context menus                     | UI       |
| createBoundingBoxes.ts  | `Comfy.CreateBoundingBoxes`                                   | Bounding-box editor widget                            | Image    |
| customWidgets.ts        | `Comfy.CustomWidgets`                                         | Registers the custom widget types used by core nodes  | Widgets  |
| dynamicPrompts.ts       | `Comfy.DynamicPrompts`                                        | Wildcard/dynamic prompt expansion                     | Prompts  |
| editAttention.ts        | `Comfy.EditAttention`                                         | Ctrl+Up/Down attention weight editing in text widgets | Text     |
| electronAdapter.ts      | `Comfy.ElectronAdapter`                                       | Desktop (Electron) environment adaptations            | Platform |
| groupNode.ts            | `Comfy.GroupNode`                                             | Migrates deprecated group nodes to subgraphs on load  | Graph    |
| groupOptions.ts         | `Comfy.GroupOptions`                                          | Group context-menu options                            | Graph    |
| imageCompare.ts         | `Comfy.ImageCompare`                                          | Side-by-side / slider image comparison widget         | Image    |
| imageCompositor.ts      | `Comfy.ImageCompositor`                                       | Layer compositing widget                              | Image    |
| imageCrop.ts            | `Comfy.ImageCrop`                                             | Image crop widget                                     | Image    |
| layerEditor.ts          | `Comfy.LayerEditor`                                           | Layer editing widget                                  | Image    |
| load3dLazy.ts           | `Comfy.Load3DLazy`                                            | Defers the THREE.js 3D stack until a 3D node is used  | 3D       |
| maskeditor.ts           | `Comfy.MaskEditor`                                            | Mask editor for image masking operations              | Image    |
| noteNode.ts             | `Comfy.NoteNode`                                              | Note nodes for documentation within workflows         | Graph    |
| painter.ts              | `Comfy.Painter`                                               | Freehand painting widget                              | Image    |
| previewAny.ts           | `Comfy.PreviewAny`                                            | Universal preview for arbitrary output types          | Preview  |
| rerouteNode.ts          | `Comfy.RerouteNode`                                           | Native reroute nodes for cleaner workflow connections | Graph    |
| saveImageExtraOutput.ts | `Comfy.SaveImageExtraOutput`                                  | Additional image output saving                        | Image    |
| saveText.ts             | `Comfy.saveText`                                              | Text output saving and preview                        | Text     |
| selectionBorder.ts      | `Comfy.SelectionBorder`                                       | Selection border rendering on canvas                  | UI       |
| simpleTouchSupport.ts   | `Comfy.SimpleTouchSupport`                                    | Basic touch and pinch-zoom interaction support        | Input    |
| slotDefaults.ts         | `Comfy.SlotDefaults`                                          | Default node suggestions for slot drag-release        | Nodes    |
| uploadAudio.ts          | `Comfy.AudioWidget`, `Comfy.UploadAudio`, `Comfy.RecordAudio` | Audio playback, upload, and recording widgets         | Audio    |
| uploadImage.ts          | `Comfy.UploadImage`                                           | Image file upload widget                              | Image    |
| webcamCapture.ts        | `Comfy.WebcamCapture`                                         | Webcam capture widget                                 | Media    |
| widgetInputs.ts         | `Comfy.WidgetInputs`                                          | Widget-to-input conversion and primitive wiring       | Widgets  |

### Conditionally Loaded

| Extension                    | Registered name             | Loads when                                                             |
| ---------------------------- | --------------------------- | ---------------------------------------------------------------------- |
| nodeTemplates.ts             | `Comfy.NodeTemplates`       | not a Cloud build                                                      |
| cloudRemoteConfig.ts         | `Comfy.Cloud.RemoteConfig`  | Cloud build                                                            |
| agentPanel.ts                | `Comfy.AgentPanel`          | Cloud build, or `VITE_AGENT_STANDALONE=true` in any other distribution |
| cloudBadges.ts               | `Comfy.Cloud.Badges`        | Cloud build                                                            |
| cloudSessionCookie.ts        | `Comfy.Cloud.SessionCookie` | Cloud build                                                            |
| cloudFeedbackTopbarButton.ts | `Comfy.FeedbackButton`      | Cloud or nightly build                                                 |
| nightlyBadges.ts             | `Comfy.Nightly.Badges`      | nightly build that is not Cloud                                        |

The Cloud block is gated on a literal `__DISTRIBUTION__ === 'cloud'` comparison
rather than the `isCloud` constant — that literal is what lets the bundler
dead-code-eliminate the block, and its `posthog-js` import, from OSS builds.
`agentPanel.ts` registers through an exported `registerAgentPanelExtension()`
rather than on import.

### Lazily Loaded (3D)

`load3dLazy.ts` dynamically imports the following the first time a 3D node
appears, so THREE.js (~1.8 MB) stays out of the initial bundle:

| Extension                  | Registered name(s)                                                                                         | Description                        |
| -------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| load3d.ts                  | `Comfy.Load3D`, `Comfy.Preview3D`                                                                          | 3D model loading and visualization |
| load3dAdvanced.ts          | `Comfy.Load3DAdvanced`                                                                                     | Advanced 3D loading options        |
| load3dPreviewExtensions.ts | `Comfy.PreviewGaussianSplat`, `Comfy.PreviewPointCloud`, `Comfy.SaveGaussianSplat`, `Comfy.SavePointCloud` | Splat and point-cloud preview/save |
| saveMesh.ts                | `Comfy.SaveGLB`                                                                                            | 3D mesh saving                     |
| cameraInfo.ts              | `Comfy.CreateCameraInfo`                                                                                   | Interactive camera-info widget     |

### Shared Helper Modules

These live alongside the extensions but register nothing themselves; they are
imported by the extensions above:

| File                      | Used by                               |
| ------------------------- | ------------------------------------- |
| textPreviewWidgets.ts     | `previewAny.ts`, `saveText.ts`        |
| widgetValuePropagation.ts | `customWidgets.ts`, `widgetInputs.ts` |

The `load3d/` subdirectory holds the TypeScript manager classes backing the 3D
viewport (`SceneManager`, `CameraManager`, `ControlsManager`, `LoaderManager`,
`AnimationManager`, the `*ModelAdapter` implementations, and others), and
`cameraInfo/` holds the camera overlay, viewport, and drag handles.

## Extension Development

When developing or modifying extensions, follow these best practices:

1. **Use provided hooks** rather than directly modifying core application objects
2. **Maintain compatibility** with other extensions
3. **Follow naming conventions** for both extension names and settings
4. **Properly document** extension hooks and functionality
5. **Test with other extensions** to ensure no conflicts

### Extension Registration

Custom extensions are registered using the `app.registerExtension()` method:

```javascript
app.registerExtension({
  name: 'MyExtension',

  // Hook implementations
  async init() {
    // Implementation
  },

  async beforeRegisterNodeDef(nodeType, nodeData, app) {
    // Implementation
  }

  // Other hooks as needed
})
```

## Extension Hooks

ComfyUI extensions can implement various hooks that are called at specific points in the application lifecycle:

### Hook Execution Sequence

#### Web Page Load

```
init
addCustomNodeDefs
getCustomWidgets
beforeRegisterNodeDef    [repeated multiple times]
registerCustomNodes
setup
beforeLoadGraph
beforeConfigureGraph
nodeCreated
loadedGraphNode
afterConfigureGraph
afterLoadGraph
```

#### Late Extension (deployments with late custom nodes on)

When a custom node script takes longer than 2 s, the editor opens without it.
Once every script has arrived, the extensions registered late run, after
every other extension's `setup`:

```
getCustomWidgets         [late extensions only]
init                     [late extensions only]
addCustomNodeDefs        [every extension]
registerCustomNodes      [late extensions only]
beforeRegisterNodeDef    [repeated multiple times, every extension]
setup                    [late extensions only]
```

The open workflow is then loaded again (see Loading Workflow below), so every
extension's per-node hooks run on its nodes.

#### Loading Workflow

```
beforeLoadGraph
beforeConfigureGraph
beforeRegisterNodeDef   [zero, one, or multiple times]
nodeCreated             [repeated multiple times]
loadedGraphNode         [repeated multiple times]
afterConfigureGraph
afterLoadGraph
```

#### Switching Workflow Tab

```
beforeLoadGraph
afterLoadGraph
```

Each open workflow keeps its own `LGraph`, so switching to a tab whose graph
is already loaded shows that instance without rebuilding its nodes. The
`configure`-phase hooks above (`beforeConfigureGraph`, `nodeCreated`,
`loadedGraphNode`, `afterConfigureGraph`) do not run. The first switch to a
background tab retained across late custom node registration also runs the
configure-phase hooks to rebuild its nodes. Extensions that refresh
per-graph DOM or Vue state when the visible graph changes should do so in
`afterLoadGraph`, which runs on both the first load and every later switch.

#### Restoring history in a background workflow

An undo or redo queued before a tab switch can restore the inactive workflow.
That restore runs these hooks:

```
beforeConfigureGraph
nodeCreated             [repeated multiple times]
loadedGraphNode         [repeated multiple times]
afterConfigureGraph
```

`beforeLoadGraph` and `afterLoadGraph` do not run because the visible workflow
does not change. Throughout the restore, `app.graph` and `app.rootGraph` refer
to the visible workflow, not the graph being configured. `loadedGraphNode`
can use `node.graph` instead. In `nodeCreated`, ordinary nodes are not yet
attached to a graph, and subgraph nodes may temporarily reference the visible
root graph. Reserve visible-graph subscriptions and DOM updates for
`afterLoadGraph`.

A failed background restore can call `onGraphLoadError` without a preceding
`beforeLoadGraph`. Error handlers must tolerate that sequence.

Load hooks must not await another graph load or workflow switch. Loads and
switches share a serial queue. Awaiting a nested operation from a load hook
deadlocks that queue.

Because each workflow owns a separate `LGraph`, extensions that cache
`app.graph` or patch it once in `setup` can stop working after the first tab.
See [Per-Workflow Graphs: Troubleshooting](#per-workflow-graphs-troubleshooting).

#### Adding New Node

```
nodeCreated
```

### Key Hooks

| Hook                          | Description                                                |
| ----------------------------- | ---------------------------------------------------------- |
| `init`                        | Called after canvas creation but before nodes are added    |
| `setup`                       | Called after the application is fully set up and running   |
| `addCustomNodeDefs`           | Called before nodes are registered with the graph          |
| `getCustomWidgets`            | Allows extensions to add custom widgets                    |
| `beforeRegisterNodeDef`       | Allows extensions to modify nodes before registration      |
| `registerCustomNodes`         | Allows extensions to register additional nodes             |
| `loadedGraphNode`             | Called when a node is reloaded onto the graph              |
| `nodeCreated`                 | Called after a node's constructor                          |
| `beforeConfigureGraph`        | Called before a graph is configured                        |
| `afterConfigureGraph`         | Called after a graph is configured                         |
| `getSelectionToolboxCommands` | Allows extensions to add commands to the selection toolbox |

For the complete list of available hooks and detailed descriptions, see the [ComfyExtension interface in comfy.ts](https://github.com/Comfy-Org/ComfyUI_frontend/blob/main/src/types/comfy.ts).

## Per-Workflow Graphs: Troubleshooting

Each open workflow owns its own `LGraph`. `app.graph` and `app.rootGraph`
return the graph of the visible tab, and they return a different object after
the user switches tabs. Code written for a single shared graph can stop working
in every tab except the first one loaded after startup.

### Recognising an affected extension

- The extension works in the first workflow and stops working after you open
  or switch to another tab.
- The browser console shows a warning like
  `MyExtension patches app.graph during setup. Temporary compatibility is deprecated.`
  The frontend logs it once per extension per session.
- An old VideoHelperSuite build shows a toast asking the user to update it.

To reproduce, open two workflows. Use the feature in the first tab, switch to
the second, use it again, then switch back and use it once more.

### Symptoms and fixes

| Symptom                                                        | Cause                                                                                       | Fix                                                                                                |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| A graph patch works only in the first tab                      | `setup` or `init` patched the `app.graph` instance, or kept a reference to it               | Patch each graph from `beforeConfigureGraph`, as shown below                                       |
| Saving, exporting or queueing uses another tab's nodes         | A handler reads a cached `app.graph` or a graph captured in a closure                       | Use `this` inside graph methods, or read `app.graph` at the moment you need it                     |
| Extension UI is stale after switching tabs                     | The UI refreshes only in `afterConfigureGraph`, which does not run when a tab is reshown    | Refresh visible UI in `afterLoadGraph`, which runs on every load and every switch                  |
| A handler fires twice after returning to a tab                 | `afterLoadGraph` installs a patch or subscription every time the tab is shown               | Keep a `WeakSet` of graphs you already handled                                                     |
| An `LGraph.prototype` patch misses the first workflow          | The prototype was patched in `setup`, after the app wrapped `onConfigure` on the boot graph | Patch `LGraph.prototype` at module top level, outside any hook                                     |
| Progress or previews from a queued job appear in the wrong tab | A websocket listener looks up node ids in `app.graph` while another tab is visible          | No supported fix yet. Check that the node exists before using it, and ignore ids it cannot resolve |

### Patching each graph

Before, the patch reaches only the first workflow loaded after startup:

```js
app.registerExtension({
  name: 'example.trackNodes',
  setup(app) {
    const onNodeAdded = app.graph.onNodeAdded
    app.graph.onNodeAdded = function (node) {
      onNodeAdded?.call(this, node)
      trackNode(node)
    }
  }
})
```

After, every graph is patched once, before its nodes are configured:

```js
const patchedGraphs = new WeakSet()

app.registerExtension({
  name: 'example.trackNodes',
  beforeConfigureGraph(graphData, missingNodeTypes, app, context) {
    const graph = context?.graph ?? app.graph
    if (patchedGraphs.has(graph)) return
    patchedGraphs.add(graph)
    const onNodeAdded = graph.onNodeAdded
    graph.onNodeAdded = function (node) {
      onNodeAdded?.call(this, node)
      trackNode(node)
    }
  }
})
```

`beforeConfigureGraph` also runs when undo or redo restores a background tab,
so the graph it receives is not always the visible one. Inside a patch, use
`this` or the graph passed in, never `app.graph`. Frontends older than
per-workflow graphs do not pass `context`, so fall back to `app.graph` as shown.

Use `afterLoadGraph` for work that follows the visible graph, such as DOM
panels, Vue state or subscriptions that update what is on screen.

### The temporary compatibility bridge

Until extensions migrate, the frontend reapplies some patches made to
`app.graph` to every later graph. It covers only patches that run synchronously
inside `init` or `setup` on these members: `add`, `remove`, `configure`,
`serialize`, `onNodeAdded`, `onNodeRemoved`, `beforeChange`, `afterChange`,
`convertToSubgraph` and `clear`. A bridged patch runs only while its graph is
visible.

The bridge does not cover:

- patches applied after an `await` in `setup`, or from other hooks such as
  `nodeCreated`;
- handlers that read `app.graph` instead of `this`;
- state captured from `app.graph` in a closure during `setup`.

An extension that defines `beforeConfigureGraph` or `afterLoadGraph` is left
out of the bridge, because it is expected to manage each graph itself. Move
all of its graph patches to those hooks in the same release.

## Further Reading

For more detailed information about ComfyUI's extension system, refer to the official documentation:

- [JavaScript Extension Overview](https://docs.comfy.org/custom-nodes/js/javascript_overview)
- [JavaScript Hooks](https://docs.comfy.org/custom-nodes/js/javascript_hooks)
- [JavaScript Objects and Hijacking](https://docs.comfy.org/custom-nodes/js/javascript_objects_and_hijacking)
- [JavaScript Settings](https://docs.comfy.org/custom-nodes/js/javascript_settings)
- [JavaScript Examples](https://docs.comfy.org/custom-nodes/js/javascript_examples)

Also, check the main [README.md](https://github.com/Comfy-Org/ComfyUI_frontend#developer-apis) section on Developer APIs for the latest information on extension APIs and features.
