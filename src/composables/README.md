# Composables

This directory contains Vue composables for the ComfyUI frontend application. Composables are reusable pieces of logic that encapsulate stateful functionality and can be shared across components.

## Table of Contents

- [Composables](#composables)
  - [Table of Contents](#table-of-contents)
  - [Overview](#overview)
  - [Composable Architecture](#composable-architecture)
  - [Composable Categories](#composable-categories)
    - [Subdirectories of `src/composables/`](#subdirectories-of-srccomposables)
    - [Auth](#auth-auth)
    - [Bottom Panel Tabs](#bottom-panel-tabs-bottompaneltabs)
    - [Element](#element-element)
    - [Node](#node-node)
    - [Sidebar Tabs](#sidebar-tabs-sidebartabs)
    - [Domain-owned composables](#domain-owned-composables)
    - [Root-level Composables](#root-level-composables)
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

Like stores, composables live with the domain that owns them. `src/composables/`
holds the shared ones; domain-specific composables sit under `src/platform/**`,
`src/renderer/**`, and `src/workbench/extensions/**`. **The directory tree is the
source of truth** — this file describes the layout rather than enumerating every
file, because an exhaustive list goes stale on the next move.

To find every composable:

```bash
find src -name 'use*.ts' -not -name '*.test.ts'
```

### Subdirectories of `src/composables/`

| Directory          | Covers                                                          |
| ------------------ | --------------------------------------------------------------- |
| `auth/`            | Current user, auth dialogs/actions, Turnstile                    |
| `billing/`         | Billing surfaces shared across the app                           |
| `bottomPanelTabs/` | Terminal, logs, shortcuts, and bottom-panel tab registration     |
| `boundingBoxes/`   | Bounding-box editing                                             |
| `canvas/`          | Canvas interaction helpers                                       |
| `element/`         | DOM positioning, clipping, coordinate conversion, overflow       |
| `functional/`      | Generic utilities (e.g. `useChainCallback`)                      |
| `graph/`           | Graph-level helpers                                              |
| `maskeditor/`      | Mask editor                                                      |
| `media/`           | Media playback and handling                                      |
| `node/`            | Node previews, drag/drop, uploads, badges, pricing               |
| `painter/`         | Freehand painting widget                                         |
| `palette/`         | Color palette                                                    |
| `queue/`           | Queue UI helpers                                                 |
| `sidebarTabs/`     | Sidebar tab definitions and registration                         |
| `tree/`            | Tree view folder operations                                      |
| `video/`           | Video handling                                                   |

### Auth (`auth/`)

| Composable        | Description                        |
| ----------------- | ---------------------------------- |
| `useCurrentUser`  | Access to the current user         |
| `useAuthActions`  | Sign-in / sign-out operations      |
| `useAuthDialogs`  | Auth dialog presentation           |
| `useTurnstile`    | Cloudflare Turnstile challenge     |

### Bottom Panel Tabs (`bottomPanelTabs/`)

| Composable               | Description                           |
| ------------------------ | ------------------------------------- |
| `useTerminal`            | Core terminal functionality           |
| `useTerminalTabs`        | Multiple terminal tab management      |
| `useLogsTerminal`        | Server logs terminal tab              |
| `useShortcutsTab`        | Keyboard shortcuts tab                |
| `useCommandSubcategories`| Groups commands for the shortcuts tab |

### Element (`element/`)

| Composable                    | Description                                 |
| ----------------------------- | ------------------------------------------- |
| `useAbsolutePosition`         | Element positioning                         |
| `useCanvasPositionConversion` | Converts between canvas and DOM coordinates |
| `useDomClipping`              | Clipping of DOM elements                    |
| `useOverflowObserver`         | Observes element overflow                   |

### Node (`node/`)

| Composable                  | Description                        |
| --------------------------- | ---------------------------------- |
| `useNodeAnimatedImage`      | Animated images in nodes           |
| `useNodeBadge`              | Node badge display and interaction |
| `useNodeCanvasImagePreview` | Canvas-based image preview         |
| `useNodeDragAndDrop`        | Drag and drop for nodes            |
| `useNodeDragToCanvas`       | Dragging a node onto the canvas    |
| `useNodeFileInput`          | File input widgets in nodes        |
| `useNodeImage`              | Node image preview                 |
| `useNodeImageUpload`        | Image upload for nodes             |
| `useNodePaste`              | Paste operations for nodes         |
| `useNodePreviewAndDrag`     | Combined preview + drag behaviour  |
| `useNodePricing`            | Pricing display for API nodes      |
| `useNodeProgressText`       | Progress text in nodes             |
| `usePartnerNodesInGraph`    | Detects partner nodes in the graph |
| `useProgressTextPreviews`   | Progress-text preview widgets      |
| `usePromotedPreviews`       | Promoted subgraph previews         |
| `useWatchWidget`            | Watches widget value changes       |

### Sidebar Tabs (`sidebarTabs/`)

| Composable                  | Description                 |
| --------------------------- | --------------------------- |
| `useAssetsSidebarTab`       | Assets sidebar tab          |
| `useJobHistorySidebarTab`   | Job history sidebar tab     |
| `useModelLibrarySidebarTab` | Model library sidebar tab   |
| `useNodeLibrarySidebarTab`  | Node library sidebar tab    |

### Domain-owned composables

These are **not** under `src/composables/`. Common ones:

| Composable                 | Location                                                              |
| -------------------------- | --------------------------------------------------------------------- |
| `useSettingSearch`         | `src/platform/settings/composables/useSettingSearch.ts`               |
| `useSettingUI`             | `src/platform/settings/composables/useSettingUI.ts`                   |
| `useLitegraphSettings`     | `src/platform/settings/composables/useLitegraphSettings.ts`           |
| `useWorkflowAutoSave`      | `src/platform/workflow/persistence/composables/useWorkflowAutoSave.ts`|
| `useWorkflowPersistenceV2` | `src/platform/workflow/persistence/composables/useWorkflowPersistenceV2.ts` |
| `useWorkflowValidation`    | `src/platform/workflow/validation/composables/useWorkflowValidation.ts`|
| `useTemplateWorkflows`     | `src/platform/workflow/templates/composables/useTemplateWorkflows.ts` |
| `useComboWidget`           | `src/renderer/extensions/vueNodes/widgets/composables/`               |
| `useRemoteWidget`          | `src/renderer/extensions/vueNodes/widgets/composables/`               |
| `useManagerQueue`          | `src/workbench/extensions/manager/composables/useManagerQueue.ts`     |
| `useRegistrySearch`        | `src/workbench/extensions/manager/composables/useRegistrySearch.ts`   |

Widget composables live with the Vue-nodes renderer under
`src/renderer/extensions/vueNodes/widgets/composables/`; node-pack helpers live
under `src/workbench/extensions/manager/composables/nodePack/`.

### Root-level Composables

General-purpose composables in `src/composables/` itself — a selection:

| Composable                  | Description                                  |
| --------------------------- | -------------------------------------------- |
| `useAppMode`                | Linear vs. graph app mode                    |
| `useBrowserTabTitle`        | Browser tab title updates                    |
| `useCachedRequest`          | Request caching                              |
| `useCanvasDrop`             | Drop operations on canvas                    |
| `useContextMenuTranslation` | Context menu translations                    |
| `useCopy` / `usePaste`      | Copy and paste                               |
| `useCopyToClipboard`        | Clipboard operations                         |
| `useCoreCommands`           | Core command registration                    |
| `useErrorHandling`          | Centralized error handling                   |
| `useFeatureFlags`           | Reactive server feature flags                |
| `useGlobalLitegraph`        | Access to the global LiteGraph instance      |
| `usePragmaticDragAndDrop`   | Atlassian pragmatic drag-and-drop wrapper    |
| `useProgressFavicon`        | Favicon progress indicator                   |
| `useRefreshableSelection`   | Refreshable selections                       |
| `useServerLogs`             | Server log streaming                         |
| `useTreeExpansion`          | Tree node expansion state                    |

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
