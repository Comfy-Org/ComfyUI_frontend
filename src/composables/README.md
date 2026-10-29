# Composables

This directory contains Vue composables for the ComfyUI frontend application. Composables are reusable pieces of logic that encapsulate stateful functionality and can be shared across components.

## Table of Contents

- [Composables](#composables)
  - [Table of Contents](#table-of-contents)
  - [Overview](#overview)
  - [Composable Architecture](#composable-architecture)
  - [Composable Categories](#composable-categories)
    - [Auth](#auth)
    - [Bottom Panel Tabs](#bottom-panel-tabs)
    - [Canvas and Graph](#canvas-and-graph)
    - [Element](#element)
    - [Functional](#functional)
    - [Node](#node)
    - [Queue](#queue)
    - [Sidebar Tabs](#sidebar-tabs)
    - [Media, Video, and Imaging](#media-video-and-imaging)
    - [Tree](#tree)
    - [Root-level Composables](#root-level-composables)
    - [Composables Outside This Directory](#composables-outside-this-directory)
  - [Usage Guidelines](#usage-guidelines)
  - [VueUse Library](#vueuse-library)
  - [Development Guidelines](#development-guidelines)
    - [Composable Template](#composable-template)
  - [Common Patterns](#common-patterns)
    - [State Management](#state-management)
    - [Event Handling with VueUse](#event-handling-with-vueuse)
    - [Fetch \& Load with VueUse](#fetch--load-with-vueuse)

## Overview

Vue composables are a core part of Vue 3's Composition API and provide a way to extract and reuse stateful logic between multiple components. In ComfyUI, composables are used to encapsulate behaviors like:

- State management
- DOM interactions
- Feature-specific functionality
- UI behaviors
- Data fetching

Composables enable a more modular and functional approach to building components, allowing for better code reuse and separation of concerns. They help keep your component code cleaner by extracting complex logic into separate, reusable functions.

As described in the [Vue.js documentation](https://vuejs.org/guide/reusability/composables.html), composables are:

> Functions that leverage Vue's Composition API to encapsulate and reuse stateful logic.

## Composable Architecture

The composable architecture in ComfyUI follows these principles:

1. **Single Responsibility**: Each composable should focus on a specific concern
2. **Composition**: Composables can use other composables
3. **Reactivity**: Composables leverage Vue's reactivity system
4. **Reusability**: Composables are designed to be used across multiple components

The following diagram shows how composables fit into the application architecture:

```
┌─────────────────────────────────────────────────────────┐
│                    Vue Components                        │
│                                                         │
│     ┌─────────────┐     ┌─────────────┐                 │
│     │ Component A │     │ Component B │                 │
│     └──────┬──────┘     └──────┬──────┘                 │
│            │                   │                        │
└────────────┼───────────────────┼────────────────────────┘
             │                   │
             ▼                   ▼
┌────────────┴───────────────────┴────────────────────────┐
│                    Composables                           │
│                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │
│  │ useFeatureA │  │ useFeatureB │  │ useFeatureC │      │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘      │
│         │                │                │             │
└─────────┼────────────────┼────────────────┼─────────────┘
          │                │                │
          ▼                ▼                ▼
┌─────────┴────────────────┴────────────────┴─────────────┐
│                    Services & Stores                     │
└─────────────────────────────────────────────────────────┘
```

## Composable Categories

`src/composables/` holds the cross-cutting composables. Composables owned by a
single domain sit with that domain under `src/platform/`, `src/renderer/`, or
`src/workbench/` — see [Composables Outside This
Directory](#composables-outside-this-directory).

This section is a map of the sub-directories, not an exhaustive index. To list
everything currently exported, run:

```bash
grep -rn "export \(function\|const\) use[A-Z]" src/composables --include='*.ts' | grep -v '\.test\.ts'
```

### Auth

`src/composables/auth/` — authentication and user management:

| Composable          | Description                            |
| ------------------- | -------------------------------------- |
| `useAuthActions`    | Sign-in, sign-out, and account actions |
| `useAuthDialogs`    | Opens the auth dialog flows            |
| `useCurrentUser`    | Access to the current user             |
| `useTurnstile`      | Cloudflare Turnstile challenge         |
| `useUpdatePassword` | Password update flow                   |

### Bottom Panel Tabs

`src/composables/bottomPanelTabs/` — terminal and bottom panel:

| Composable              | Description                        |
| ----------------------- | ---------------------------------- |
| `useCommandTerminalTab` | Registers the command terminal tab |
| `useLogsTerminal`       | Server log terminal contents       |
| `useLogsTerminalTab`    | Registers the logs terminal tab    |
| `useTerminal`           | Core xterm terminal functionality  |

### Canvas and Graph

`src/composables/canvas/` covers selection and focus on the canvas
(`useFocusNode`, `useSelectedLiteGraphItems`, `useSelectionToolboxPosition`).

`src/composables/graph/` covers graph operations and canvas context menus —
node arrangement (`useArrangeNodes`, `useNodeArrangement`, `useFrameNodes`),
menu construction (`useNodeMenuOptions`, `useGroupMenuOptions`,
`useSelectionMenuOptions`, `useMoreOptionsMenu`), selection
(`useSelectionState`, `useSelectionOperations`, `useSelectedNodeActions`), and
subgraph operations (`useSubgraphOperations`, `useGraphHierarchy`).

### Element

`src/composables/element/` — DOM and element interactions:

| Composable                          | Description                                 |
| ----------------------------------- | ------------------------------------------- |
| `useAbsolutePosition`               | Element positioning                         |
| `useCanvasPositionConversion`       | Converts between canvas and DOM coordinates |
| `useSharedCanvasPositionConversion` | Shared instance of the above                |
| `useDomClipping`                    | Clipping of DOM elements                    |
| `useOverflowObserver`               | Observes element overflow                   |

### Functional

`src/composables/functional/` — `useChainCallback`, which chains multiple
callbacks together.

### Node

`src/composables/node/` — node-specific functionality:

| Composable                   | Description                                   |
| ---------------------------- | --------------------------------------------- |
| `useComputedWithWidgetWatch` | Recomputes when a node's widget values change |
| `useNodeAnimatedImage`       | Animated images in nodes                      |
| `useNodeBadge`               | Node badge display and interaction            |
| `useNodeCanvasImagePreview`  | Canvas-based image preview for nodes          |
| `useNodeDragAndDrop`         | Drag and drop onto nodes                      |
| `useNodeDragToCanvas`        | Dragging a node onto the canvas               |
| `useNodeFileInput`           | File input widgets in nodes                   |
| `useNodeImage`               | Node image preview                            |
| `useNodeImageUpload`         | Image upload for nodes                        |
| `useNodePaste`               | Paste operations for nodes                    |
| `useNodePreviewAndDrag`      | Combined node preview and drag behaviour      |
| `useNodePricing`             | Pricing display for nodes                     |
| `useNodeProgressText`        | Progress text in nodes                        |
| `useNodeVideo`               | Video outputs on nodes                        |
| `usePartnerNodesInGraph`     | Detects partner nodes in the active graph     |
| `useProgressTextPreviews`    | Progress text previews                        |
| `usePromotedPreviews`        | Previews promoted through subgraph hosts      |

### Queue

`src/composables/queue/` — job list, job menu, progress, result gallery, and
queue feature flags (`useJobList`, `useJobMenu`, `useQueueProgress`,
`useResultGallery`, `useQueueFeatureFlags`, `useQueueNotificationBanners`,
`useQueueClearHistoryDialog`).

### Sidebar Tabs

`src/composables/sidebarTabs/` — registers sidebar tabs:

| Composable                  | Description               |
| --------------------------- | ------------------------- |
| `useAssetsSidebarTab`       | Assets sidebar tab        |
| `useJobHistorySidebarTab`   | Job history sidebar tab   |
| `useModelLibrarySidebarTab` | Model library sidebar tab |
| `useNodeLibrarySidebarTab`  | Node library sidebar tab  |

### Media, Video, and Imaging

`src/composables/media/` (`useRetryableMediaSrc`),
`src/composables/video/` (filmstrip, trim, crop, and format helpers such as
`useVideoFilmstrip`, `useTrimPlayback`, `useCropBoxEditor`,
`useVideoEditFormats`), `src/composables/boundingBoxes/`
(`useBoundingBoxes`), and `src/composables/palette/`
(`usePaletteSwatchRow`).

### Tree

`src/composables/tree/` — `useTreeFolderOperations`, which handles folder
operations in tree views.

### Root-level Composables

General-purpose composables directly under `src/composables/`. A selection:

| Composable                  | Description                                          |
| --------------------------- | ---------------------------------------------------- |
| `useAppMode`                | App vs graph view mode                               |
| `useBrowserTabTitle`        | Browser tab title updates                            |
| `useCachedRequest`          | Request caching                                      |
| `useCanvasDrop`             | Drop operations on canvas                            |
| `useContextMenuTranslation` | Context menu translations                            |
| `useCopy` / `usePaste`      | Canvas copy and paste                                |
| `useCopyToClipboard`        | Clipboard operations                                 |
| `useCoreCommands`           | Core command definitions                             |
| `useErrorHandling`          | Centralized error handling                           |
| `useFeatureFlags`           | Reactive feature flags (see `docs/FEATURE_FLAGS.md`) |
| `useGlobalLitegraph`        | Access to the global LiteGraph instance              |
| `usePragmaticDraggable`     | Atlassian pragmatic drag-and-drop: draggable         |
| `usePragmaticDroppable`     | Atlassian pragmatic drag-and-drop: drop target       |
| `useProgressFavicon`        | Favicon progress indicator                           |
| `useRefreshableSelection`   | Refreshable selections                               |
| `useServerLogs`             | Server log streaming                                 |
| `useTreeExpansion`          | Tree node expansion state                            |

### Composables Outside This Directory

Several composable families moved out of `src/composables/` with their domain:

| Family             | Location                                                 | Examples                                                                                                                                                                           |
| ------------------ | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Manager            | `src/workbench/extensions/manager/composables/`          | `useManagerState`, `useManagerQueue`, `useConflictDetection`, `useRegistrySearch`                                                                                                  |
| Node packs         | `src/workbench/extensions/manager/composables/nodePack/` | `useInstalledPacks`, `useMissingNodes`, `useNodePacks`, `useWorkflowPacks`                                                                                                         |
| Settings           | `src/platform/settings/composables/`                     | `useSettingSearch`, `useSettingUI`, `useLitegraphSettings`                                                                                                                         |
| Vue node widgets   | `src/renderer/extensions/vueNodes/widgets/composables/`  | `useBooleanWidget`, `useComboWidget`, `useFloatWidget`, `useIntWidget`, `useStringWidget`, `useMarkdownWidget`, `useRemoteWidget`, `useImagePreviewWidget`, `useImageUploadWidget` |
| Workflow lifecycle | `src/platform/workflow/`                                 | `useWorkflowAutoSave`, `useWorkflowPersistenceV2`, `useWorkflowValidation`, `useWorkflowsSidebarTab`, `useTemplateWorkflows`                                                       |
| Assets             | `src/platform/assets/composables/`                       | `useAssetSelectionStore`, `useMediaAssetGalleryStore`                                                                                                                              |

## Usage Guidelines

When using composables in components, follow these guidelines:

1. **Import and call** composables at the top level of the `setup` function
2. **Destructure returned values** to use in your component
3. **Respect reactivity** by not destructuring reactive objects
4. **Handle cleanup** by using `onUnmounted` when necessary
5. **Use VueUse** for common functionality instead of writing from scratch

Example usage:

```vue
<template>
  <div
    :class="{ dragging: isDragging }"
    @mousedown="startDrag"
    @mouseup="endDrag"
  >
    <img v-if="imageUrl" :src="imageUrl" alt="Node preview" />
  </div>
</template>

<script setup lang="ts">
import { useNodeDragAndDrop } from '@/composables/node/useNodeDragAndDrop'
import { useNodeImage } from '@/composables/node/useNodeImage'

// Use composables at the top level
const { isDragging, startDrag, endDrag } = useNodeDragAndDrop()
const { imageUrl, loadImage } = useNodeImage()

// Use returned values in your component
</script>
```

## VueUse Library

ComfyUI leverages the [VueUse](https://vueuse.org/) library, which provides a collection of essential Vue Composition API utilities. Instead of implementing common functionality from scratch, prefer using VueUse composables for:

- DOM event handling (`useEventListener`, `useMouseInElement`)
- Element measurements (`useElementBounding`, `useElementSize`)
- Asynchronous operations (`useAsyncState`, `useFetch`)
- Animation and timing (`useTransition`, `useTimeout`, `useInterval`)
- Browser APIs (`useLocalStorage`, `useClipboard`)
- Sensors (`useDeviceMotion`, `useDeviceOrientation`)
- State management (`createGlobalState`, `useStorage`)
- ...and [more](https://vueuse.org/functions.html)

Examples:

```js
// Instead of manually adding/removing event listeners
import { useEventListener } from '@vueuse/core'

useEventListener(window, 'resize', handleResize)

// Instead of manually tracking element measurements
import { useElementBounding } from '@vueuse/core'

const { width, height, top, left } = useElementBounding(elementRef)

// Instead of manual async state management
import { useAsyncState } from '@vueuse/core'

const { state, isReady, isLoading } = useAsyncState(
  fetch('https://api.example.com/data').then((r) => r.json()),
  { data: [] }
)
```

For a complete list of available functions, see the [VueUse documentation](https://vueuse.org/functions.html).

## Development Guidelines

When creating or modifying composables, follow these best practices:

1. **Name with `use` prefix**: All composables should start with "use"
2. **Return an object**: Composables should return an object with named properties/methods
3. **Handle cleanup**: Use `onUnmounted` to clean up resources
4. **Document parameters and return values**: Add JSDoc comments
5. **Test composables**: Write unit tests for composable functionality
6. **Use VueUse**: Leverage VueUse composables instead of reimplementing common functionality
7. **Implement proper cleanup**: Cancel debounced functions, pending requests, and clear maps
8. **Use watchDebounced/watchThrottled**: For performance-sensitive reactive operations

### Composable Template

Here's a template for creating a new composable:

```typescript
import { ref, computed, onMounted, onUnmounted } from 'vue'

/**
 * Composable for [functionality description]
 * @param options Configuration options
 * @returns Object containing state and methods
 */
export function useExample(options = {}) {
  // State
  const state = ref({
    // Initial state
  })

  // Computed values
  const derivedValue = computed(() => {
    // Compute from state
    return state.value.someProperty
  })

  // Methods
  function doSomething() {
    // Implementation
  }

  // Lifecycle hooks
  onMounted(() => {
    // Setup
  })

  onUnmounted(() => {
    // Cleanup
  })

  // Return exposed state and methods
  return {
    state,
    derivedValue,
    doSomething
  }
}
```

## Common Patterns

Composables in ComfyUI frequently use these patterns:

### State Management

```typescript
export function useState() {
  const count = ref(0)

  function increment() {
    count.value++
  }

  return {
    count,
    increment
  }
}
```

### Event Handling with VueUse

```typescript
import { useEventListener } from '@vueuse/core'

export function useKeyPress(key) {
  const isPressed = ref(false)

  useEventListener('keydown', (e) => {
    if (e.key === key) {
      isPressed.value = true
    }
  })

  useEventListener('keyup', (e) => {
    if (e.key === key) {
      isPressed.value = false
    }
  })

  return { isPressed }
}
```

### Fetch & Load with VueUse

```typescript
import { useAsyncState } from '@vueuse/core'

export function useFetchData(url) {
  const {
    state: data,
    isLoading,
    error,
    execute: refresh
  } = useAsyncState(
    async () => {
      const response = await fetch(url)
      if (!response.ok) throw new Error('Failed to fetch data')
      return response.json()
    },
    null,
    { immediate: true }
  )

  return { data, isLoading, error, refresh }
}
```

For more information on Vue composables, refer to the [Vue.js Composition API documentation](https://vuejs.org/guide/reusability/composables.html) and the [VueUse documentation](https://vueuse.org/).
