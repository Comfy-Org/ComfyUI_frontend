# Core Extensions

This directory contains the core extensions that provide essential functionality to the ComfyUI frontend.

## Table of Contents

- [Overview](#overview)
- [Extension Architecture](#extension-architecture)
- [Core Extensions](#core-extensions)
- [Extension Development](#extension-development)
- [Extension Hooks](#extension-hooks)
- [Further Reading](#further-reading)

## Overview

Extensions in ComfyUI are modular JavaScript modules that extend and enhance the functionality of the frontend. The extensions in this directory are considered "core" as they provide fundamental features that are built into ComfyUI by default.

## Extension Architecture

ComfyUI's extension system follows these key principles:

1. **Registration-based:** Extensions must register themselves with the application using `app.registerExtension()`
2. **Hook-driven:** Extensions interact with the system through predefined hooks
3. **Non-intrusive:** Extensions should avoid directly modifying core objects where possible

## Core Extensions List

Core extensions live in `src/extensions/core/`. `index.ts` is the entry point
that decides which ones load — some are unconditional, some are gated on the
build distribution, and the 3D stack is deferred behind a lazy loader. The
tables below follow that grouping.

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

| Extension                    | Loads when                      | Description                                         |
| ---------------------------- | ------------------------------- | --------------------------------------------------- |
| nodeTemplates.ts             | not a Cloud build               | Save/restore node templates (`Comfy.NodeTemplates`) |
| cloudRemoteConfig.ts         | Cloud build                     | Remote feature configuration                        |
| agentPanel.ts                | Cloud build                     | In-app agent side panel                             |
| cloudBadges.ts               | Cloud build                     | Cloud-specific node badges                          |
| cloudSessionCookie.ts        | Cloud build                     | Session cookie synchronisation                      |
| cloudFeedbackTopbarButton.ts | Cloud or nightly build          | Feedback button in the top bar                      |
| nightlyBadges.ts             | nightly build that is not Cloud | Nightly build badges                                |

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

Extensions are registered using the `app.registerExtension()` method:

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
beforeConfigureGraph
nodeCreated
loadedGraphNode
afterConfigureGraph
setup
```

#### Loading Workflow

```
beforeConfigureGraph
beforeRegisterNodeDef   [zero, one, or multiple times]
nodeCreated             [repeated multiple times]
loadedGraphNode         [repeated multiple times]
afterConfigureGraph
```

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

## Further Reading

For more detailed information about ComfyUI's extension system, refer to the official documentation:

- [JavaScript Extension Overview](https://docs.comfy.org/custom-nodes/js/javascript_overview)
- [JavaScript Hooks](https://docs.comfy.org/custom-nodes/js/javascript_hooks)
- [JavaScript Objects and Hijacking](https://docs.comfy.org/custom-nodes/js/javascript_objects_and_hijacking)
- [JavaScript Settings](https://docs.comfy.org/custom-nodes/js/javascript_settings)
- [JavaScript Examples](https://docs.comfy.org/custom-nodes/js/javascript_examples)

Also, check the main [README.md](https://github.com/Comfy-Org/ComfyUI_frontend#developer-apis) section on Developer APIs for the latest information on extension APIs and features.
