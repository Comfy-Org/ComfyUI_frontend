# Composables

This directory contains Vue composables for the ComfyUI frontend application. Composables are reusable pieces of logic that encapsulate stateful functionality and can be shared across components.

## Table of Contents

- [Overview](#overview)
- [Composable Architecture](#composable-architecture)
- [Composable Categories](#composable-categories)
- [Usage Guidelines](#usage-guidelines)
- [VueUse Library](#vueuse-library)
- [Development Guidelines](#development-guidelines)
- [Common Patterns](#common-patterns)

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

ComfyUI's composables are organized into several categories:

### Auth

Composables for authentication and user management:
- `useCurrentUser` - Provides access to the current user information
- `useFirebaseAuthActions` - Handles Firebase authentication operations

### Element

Composables for DOM and element interactions:
- `useAbsolutePosition` - Handles element positioning
- `useDomClipping` - Manages clipping of DOM elements
- `useResponsiveCollapse` - Manages responsive collapsing of elements

### Node

Composables for node-specific functionality:
- `useNodeBadge` - Handles node badge display and interaction
- `useNodeImage` - Manages node image preview
- `useNodeDragAndDrop` - Handles drag and drop for nodes
- `useNodeChatHistory` - Manages chat history for nodes

### Settings

Composables for settings management:
- `useSettingSearch` - Provides search functionality for settings
- `useSettingUI` - Manages settings UI interactions

### Sidebar

Composables for sidebar functionality:
- `useNodeLibrarySidebarTab` - Manages the node library sidebar tab
- `useQueueSidebarTab` - Manages the queue sidebar tab
- `useWorkflowsSidebarTab` - Manages the workflows sidebar tab

### Widgets

Composables for widget functionality:
- `useBooleanWidget` - Manages boolean widget interactions
- `useComboWidget` - Manages combo box widget interactions
- `useFloatWidget` - Manages float input widget interactions
- `useImagePreviewWidget` - Manages image preview widget

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
    :class="{ 'dragging': isDragging }" 
    @mousedown="startDrag"
    @mouseup="endDrag"
  >
    <img v-if="imageUrl" :src="imageUrl" alt="Node preview" />
  </div>
</template>

<script setup lang="ts">
import { useNodeDragAndDrop } from '@/composables/node/useNodeDragAndDrop';
import { useNodeImage } from '@/composables/node/useNodeImage';

// Use composables at the top level
const { isDragging, startDrag, endDrag } = useNodeDragAndDrop();
const { imageUrl, loadImage } = useNodeImage();

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
  fetch('https://api.example.com/data').then(r => r.json()),
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
import { ref, computed, onMounted, onUnmounted } from 'vue';

/**
 * Composable for [functionality description]
 * @param options Configuration options
 * @returns Object containing state and methods
 */
export function useExample(options = {}) {
  // State
  const state = ref({
    // Initial state
  });

  // Computed values
  const derivedValue = computed(() => {
    // Compute from state
    return state.value.someProperty;
  });

  // Methods
  function doSomething() {
    // Implementation
  }

  // Lifecycle hooks
  onMounted(() => {
    // Setup
  });

  onUnmounted(() => {
    // Cleanup
  });

  // Return exposed state and methods
  return {
    state,
    derivedValue,
    doSomething
  };
}
```

## Common Patterns

Composables in ComfyUI frequently use these patterns:

### State Management

```typescript
export function useState() {
  const count = ref(0);
  
  function increment() {
    count.value++;
  }
  
  return {
    count,
    increment
  };
}
```

### Event Handling with VueUse

```typescript
import { useEventListener } from '@vueuse/core';

export function useKeyPress(key) {
  const isPressed = ref(false);
  
  useEventListener('keydown', (e) => {
    if (e.key === key) {
      isPressed.value = true;
    }
  });
  
  useEventListener('keyup', (e) => {
    if (e.key === key) {
      isPressed.value = false;
    }
  });
  
  return { isPressed };
}
```

### Fetch & Load with VueUse

```typescript
import { useAsyncState } from '@vueuse/core';

export function useFetchData(url) {
  const { state: data, isLoading, error, execute: refresh } = useAsyncState(
    async () => {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch data');
      return response.json();
    },
    null,
    { immediate: true }
  );
  
  return { data, isLoading, error, refresh };
}
```

For more information on Vue composables, refer to the [Vue.js Composition API documentation](https://vuejs.org/guide/reusability/composables.html) and the [VueUse documentation](https://vueuse.org/).