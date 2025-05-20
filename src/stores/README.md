# Stores

This directory contains Pinia stores for the ComfyUI frontend application. Stores provide centralized state management for the application.

## Table of Contents

- [Overview](#overview)
- [Store Architecture](#store-architecture)
- [Core Stores](#core-stores)
- [Store Development Guidelines](#store-development-guidelines)
- [Common Patterns](#common-patterns)
- [Testing Stores](#testing-stores)

## Overview

Stores in ComfyUI use [Pinia](https://pinia.vuejs.org/), Vue's official state management library. Each store is responsible for managing a specific domain of the application state, such as user data, workflow information, graph state, and UI configuration.

Stores provide a way to maintain global application state that can be accessed from any component, regardless of where those components are in the component hierarchy. This solves the problem of "prop drilling" (passing data down through multiple levels of components) and allows components that aren't directly related to share and modify the same state.

For example, without global state:
```
                  App
                   │
        ┌──────────┴──────────┐
        │                     │
    HeaderBar               Canvas
        │                     │
        │                     │
    UserMenu            NodeProperties
```

In this structure, if the `UserMenu` component needs to update something that affects `NodeProperties`, the data would need to be passed up to `App` and then down again, through all intermediate components.

With Pinia stores, components can directly access and update the shared state:
```
    ┌─────────────────┐
    │                 │
    │  Pinia Stores   │
    │                 │
    └───────┬─────────┘
            │
            │ Accessed by
            ▼
┌──────────────────────────┐
│                          │
│       Components         │
│                          │
└──────────────────────────┘
```

## Store Architecture

The store architecture in ComfyUI follows these principles:

1. **Domain-driven**: Each store focuses on a specific domain of the application
2. **Single source of truth**: Stores serve as the definitive source for specific data
3. **Composition**: Stores can interact with other stores when needed
4. **Actions for logic**: Business logic is encapsulated in store actions
5. **Getters for derived state**: Computed values are exposed via getters

The following diagram illustrates the store architecture and data flow:

```
┌─────────────────────────────────────────────────────────┐
│                    Vue Components                        │
│                                                         │
│   ┌───────────────┐            ┌───────────────┐        │
│   │  Component A  │            │  Component B  │        │
│   └───────┬───────┘            └───────┬───────┘        │
│           │                            │                │
└───────────┼────────────────────────────┼────────────────┘
            │                            │
            │     ┌───────────────┐      │
            └────►│  Composables  │◄─────┘
                  └───────┬───────┘
                          │
┌─────────────────────────┼─────────────────────────────┐
│         Pinia Stores    │                             │
│                         │                             │
│     ┌───────────────────▼───────────────────────┐     │
│     │                 Actions                    │     │
│     └───────────────────┬───────────────────────┘     │
│                         │                             │
│     ┌───────────────────▼───────────────────────┐     │
│     │                  State                     │     │
│     └───────────────────┬───────────────────────┘     │
│                         │                             │
│     ┌───────────────────▼───────────────────────┐     │
│     │                 Getters                    │     │
│     └───────────────────┬───────────────────────┘     │
│                         │                             │
└─────────────────────────┼─────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                   External Services                      │
│       (API, localStorage, WebSocket, etc.)              │
└─────────────────────────────────────────────────────────┘
```

## Core Stores

The core stores include:

| Store | Description |
|-------|-------------|
| aboutPanelStore.ts | Manages the About panel state and badges |
| apiKeyAuthStore.ts | Handles API key authentication |
| comfyManagerStore.ts | Manages ComfyUI application state |
| comfyRegistryStore.ts | Handles extensions registry |
| commandStore.ts | Manages commands and command execution |
| dialogStore.ts | Controls dialog/modal display and state |
| domWidgetStore.ts | Manages DOM widget state |
| executionStore.ts | Tracks workflow execution state |
| extensionStore.ts | Manages extension registration and state |
| firebaseAuthStore.ts | Handles Firebase authentication |
| graphStore.ts | Manages the graph canvas state |
| imagePreviewStore.ts | Controls image preview functionality |
| keybindingStore.ts | Manages keyboard shortcuts |
| menuItemStore.ts | Handles menu items and their state |
| modelStore.ts | Manages AI models information |
| nodeDefStore.ts | Manages node definitions |
| queueStore.ts | Handles the execution queue |
| settingStore.ts | Manages application settings |
| userStore.ts | Manages user data and preferences |
| workflowStore.ts | Handles workflow data and operations |
| workspace/* | Stores related to the workspace UI |

## Store Development Guidelines

When developing or modifying stores, follow these best practices:

1. **Define clear purpose**: Each store should have a specific responsibility
2. **Use actions for async operations**: Encapsulate asynchronous logic in actions
3. **Keep stores focused**: Each store should manage related state
4. **Document public API**: Add comments for state properties, actions, and getters
5. **Use getters for derived state**: Compute derived values using getters
6. **Test store functionality**: Write unit tests for stores

### Store Template

Here's a template for creating a new Pinia store, following the setup style used in ComfyUI:

```typescript
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export const useExampleStore = defineStore('example', () => {
  // State
  const items = ref([])
  const isLoading = ref(false)
  const error = ref(null)

  // Getters
  const itemCount = computed(() => items.value.length)
  const hasError = computed(() => error.value !== null)

  // Actions
  function addItem(item) {
    items.value.push(item)
  }

  async function fetchItems() {
    isLoading.value = true
    error.value = null
    
    try {
      const response = await fetch('/api/items')
      const data = await response.json()
      items.value = data
    } catch (err) {
      error.value = err.message
    } finally {
      isLoading.value = false
    }
  }

  // Expose state, getters, and actions
  return {
    // State
    items,
    isLoading,
    error,
    
    // Getters
    itemCount,
    hasError,
    
    // Actions
    addItem,
    fetchItems
  }
})
```

## Common Patterns

Stores in ComfyUI frequently use these patterns:

### API Integration

```typescript
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/scripts/api'

export const useDataStore = defineStore('data', () => {
  const data = ref([])
  const loading = ref(false)
  const error = ref(null)

  async function fetchData() {
    loading.value = true
    try {
      const result = await api.getData()
      data.value = result
    } catch (err) {
      error.value = err.message
    } finally {
      loading.value = false
    }
  }

  return {
    data,
    loading,
    error,
    fetchData
  }
})
```

### Store Composition

```typescript
import { defineStore, storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useOtherStore } from './otherStore'

export const useComposedStore = defineStore('composed', () => {
  const otherStore = useOtherStore()
  const { someData } = storeToRefs(otherStore)
  
  // Local state
  const localState = ref(0)
  
  // Computed value based on other store
  const derivedValue = computed(() => {
    return computeFromOtherData(someData.value, localState.value)
  })
  
  // Action that uses another store
  async function complexAction() {
    await otherStore.someAction()
    localState.value += 1
  }
  
  return {
    localState,
    derivedValue,
    complexAction
  }
})
```

### Persistent State

```typescript
import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export const usePreferencesStore = defineStore('preferences', () => {
  // Load from localStorage if available
  const theme = ref(localStorage.getItem('theme') || 'light')
  const fontSize = ref(parseInt(localStorage.getItem('fontSize') || '14'))
  
  // Save to localStorage when changed
  watch(theme, (newTheme) => {
    localStorage.setItem('theme', newTheme)
  })
  
  watch(fontSize, (newSize) => {
    localStorage.setItem('fontSize', newSize.toString())
  })
  
  function setTheme(newTheme) {
    theme.value = newTheme
  }
  
  return {
    theme,
    fontSize,
    setTheme
  }
})
```

## Testing Stores

Stores should be tested to ensure they behave as expected. Here's an example of how to test a store:

```typescript
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { api } from '@/scripts/api'
import { useExampleStore } from '@/stores/exampleStore'

// Mock API dependencies
vi.mock('@/scripts/api', () => ({
  api: {
    getData: vi.fn()
  }
}))

describe('useExampleStore', () => {
  let store: ReturnType<typeof useExampleStore>

  beforeEach(() => {
    // Create a fresh pinia instance and make it active
    setActivePinia(createPinia())
    store = useExampleStore()
    
    // Clear all mocks
    vi.clearAllMocks()
  })

  it('should initialize with default state', () => {
    expect(store.items).toEqual([])
    expect(store.isLoading).toBe(false)
    expect(store.error).toBeNull()
  })

  it('should add an item', () => {
    store.addItem('test')
    expect(store.items).toEqual(['test'])
    expect(store.itemCount).toBe(1)
  })
  
  it('should fetch items', async () => {
    // Setup mock response
    vi.mocked(api.getData).mockResolvedValue(['item1', 'item2'])
    
    // Call the action
    await store.fetchItems()
    
    // Verify state changes
    expect(store.isLoading).toBe(false)
    expect(store.items).toEqual(['item1', 'item2'])
    expect(store.error).toBeNull()
  })
})
```

For more information on Pinia, refer to the [Pinia documentation](https://pinia.vuejs.org/introduction.html).