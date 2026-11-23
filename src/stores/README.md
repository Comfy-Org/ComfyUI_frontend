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

Stores live both in this directory and next to their domain under
`src/platform/`, `src/renderer/`, `src/workbench/`, and `src/core/`. Shared,
framework-free store logic lives in workspace packages (for example
`packages/settings-core`). To list every store, run:

```bash
git grep -n "defineStore(" -- src
```

The tables below cover the most commonly used stores. Paths are relative to
`src/`.

### Main Stores (`src/stores/`)

| File                       | Store                         | Description                                   | Category   |
| -------------------------- | ----------------------------- | --------------------------------------------- | ---------- |
| aboutPanelStore.ts         | useAboutPanelStore            | Manages the About panel state and badges      | UI         |
| apiKeyAuthStore.ts         | useApiKeyAuthStore            | Handles API key authentication                | Auth       |
| appModeStore.ts            | useAppModeStore               | Tracks the app/graph view mode and builder    | UI         |
| assetsStore.ts             | useAssetsStore                | Manages input/output assets                   | Media      |
| authStore.ts               | useAuthStore                  | Handles Firebase authentication               | Auth       |
| bootstrapStore.ts          | useBootstrapStore             | Coordinates app startup                       | Core       |
| comfyRegistryStore.ts      | useComfyRegistryStore         | Handles the custom-node registry              | Registry   |
| dialogStore.ts             | useDialogStore                | Controls dialog/modal display and state       | UI         |
| domWidgetStore.ts          | useDomWidgetStore             | Manages DOM widget state                      | Widgets    |
| electronDownloadStore.ts   | useElectronDownloadStore      | Handles Electron-specific download operations | Platform   |
| executionErrorStore.ts     | useExecutionErrorStore        | Tracks execution and validation errors        | Execution  |
| executionStore.ts          | useExecutionStore             | Tracks workflow execution state               | Execution  |
| helpCenterStore.ts         | useHelpCenterStore            | Manages help center visibility and state      | UI         |
| linkStore.ts               | useLinkStore                  | Owns link identity and indexes                | Graph      |
| menuItemStore.ts           | useMenuItemStore              | Handles menu items and their state            | UI         |
| modelStore.ts              | useModelStore                 | Manages model information                     | Models     |
| modelToNodeStore.ts        | useModelToNodeStore           | Maps models to compatible nodes               | Models     |
| nodeBookmarkStore.ts       | useNodeBookmarkStore          | Manages node bookmarks                        | Nodes      |
| nodeDataStore.ts           | useNodeDataStore              | Owns reactive node state                      | Graph      |
| nodeDefStore.ts            | useNodeDefStore               | Manages node definitions and schemas          | Nodes      |
| nodeFrequencyStore.ts      | useNodeFrequencyStore         | Tracks node usage frequency                   | Nodes      |
| nodeOutputStore.ts         | useNodeOutputStore            | Manages node outputs and execution results    | Media      |
| queueStore.ts              | useQueueStore                 | Manages execution queue and task history      | Execution  |
| queueStore.ts              | useQueuePendingTaskCountStore | Tracks pending task counts                    | Execution  |
| queueSettingsStore.ts      | useQueueSettingsStore         | Manages queue execution settings              | Execution  |
| rerouteStore.ts            | useRerouteStore               | Owns reroute state                            | Graph      |
| serverConfigStore.ts       | useServerConfigStore          | Handles server configuration                  | Config     |
| subgraphNavigationStore.ts | useSubgraphNavigationStore    | Handles subgraph navigation state             | Navigation |
| subgraphStore.ts           | useSubgraphStore              | Manages subgraph blueprints                   | Graph      |
| systemStatsStore.ts        | useSystemStatsStore           | Tracks system statistics                      | System     |
| userFileStore.ts           | useUserFileStore              | Manages user file operations                  | Files      |
| userStore.ts               | useUserStore                  | Manages user data                             | User       |
| widgetStore.ts             | useWidgetStore                | Manages widget configurations                 | Widgets    |
| widgetValueStore.ts        | useWidgetValueStore           | Owns widget values keyed by `WidgetId`        | Widgets    |
| workspaceStore.ts          | useWorkspaceStore             | Manages overall workspace state               | Workspace  |

### Workspace Stores (`src/stores/workspace/`)

| File                       | Store                      | Description                                 | Category |
| -------------------------- | -------------------------- | ------------------------------------------- | -------- |
| assetsSidebarBadgeStore.ts | useAssetsSidebarBadgeStore | Tracks the assets sidebar badge             | UI       |
| bottomPanelStore.ts        | useBottomPanelStore        | Controls bottom panel visibility and state  | UI       |
| nodeHelpStore.ts           | useNodeHelpStore           | Handles node help and documentation display | UI       |
| searchBoxStore.ts          | useSearchBoxStore          | Manages search box functionality            | UI       |
| sidebarTabStore.ts         | useSidebarTabStore         | Controls sidebar tab states and navigation  | UI       |

### Domain Stores (outside `src/stores/`)

| File                                                               | Store                        | Description                                              |
| ------------------------------------------------------------------ | ---------------------------- | -------------------------------------------------------- |
| components/ui/toast/toastStore.ts                                  | useToast                     | Manages toast notifications                              |
| core/selection/selectionStore.ts                                   | useSelectionStore            | Tracks canvas selection                                  |
| platform/customNodes/manager/stores/comfyManagerStore.ts           | useComfyManagerStore         | Manages custom-node manager state                        |
| platform/extensions/stores/extensionStore.ts                       | useExtensionStore            | Manages extension registration and state                 |
| platform/keybindings/commandStore.ts                               | useCommandStore              | Manages commands and command execution                   |
| platform/settings/settingStore.ts                                  | useSettingStore              | Manages application settings (`@comfyorg/settings-core`) |
| platform/updates/common/releaseStore.ts                            | useReleaseStore              | Manages application release information                  |
| platform/updates/common/versionCompatibilityStore.ts               | useVersionCompatibilityStore | Manages frontend/backend version compatibility warnings  |
| platform/workflow/management/stores/workflowStore.ts               | useWorkflowStore             | Handles workflow data and operations                     |
| platform/workflow/management/stores/workflowStore.ts               | useWorkflowBookmarkStore     | Manages workflow bookmarks                               |
| platform/workflow/templates/repositories/workflowTemplatesStore.ts | useWorkflowTemplatesStore    | Manages workflow templates                               |
| renderer/core/canvas/canvasStore.ts                                | useCanvasStore               | Manages the graph canvas state and interactions          |
| renderer/core/canvas/canvasStore.ts                                | useTitleEditorStore          | Manages title editing for nodes and groups               |

## Store Development Guidelines

When developing or modifying stores, follow these best practices:

1. **Define clear purpose**: Each store should have a specific responsibility
2. **Use actions for async operations**: Encapsulate asynchronous logic in actions
3. **Keep stores focused**: Each store should manage related state
4. **Name the public API clearly**: Names should make state, actions, and getters self-explanatory. Add curt JSDoc only where an exported action's contract is not obvious, and no other comments
5. **Use getters for derived state**: Compute derived values using getters
6. **Test store functionality**: Write unit tests for stores

### Store Template

Here's a template for creating a new Pinia store, following the setup style used in ComfyUI:

```typescript
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { api } from '@/scripts/api'

export const useExampleStore = defineStore('example', () => {
  const items = ref<string[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const itemCount = computed(() => items.value.length)
  const hasError = computed(() => error.value !== null)

  function addItem(item: string) {
    items.value.push(item)
  }

  async function fetchItems() {
    isLoading.value = true
    error.value = null

    const response = await api.fetchApi('/items')
    if (response.ok) {
      items.value = await response.json()
    } else {
      error.value = response.statusText
    }
    isLoading.value = false
  }

  return {
    items,
    isLoading,
    error,
    itemCount,
    hasError,
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
      const result = await api.getExtensions()
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

Stores should be tested to ensure they behave as expected. `vitest.setup.ts`
activates a fresh testing Pinia before every test, so a store test never
creates its own — the `comfy/use-global-pinia` oxlint rule fails any test file
that imports `createPinia`/`createTestingPinia`. Vitest is also configured with
`mockReset`/`restoreMocks`, so per-test mock cleanup is unnecessary.

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'
import { useExampleStore } from '@/stores/exampleStore'

vi.mock(import('@/scripts/api'), () => ({
  api: {
    fetchApi: vi.fn()
  }
}))

describe('useExampleStore', () => {
  let store: ReturnType<typeof useExampleStore>

  beforeEach(() => {
    store = useExampleStore()
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
    vi.mocked(api.fetchApi).mockResolvedValue(Response.json(['item1', 'item2']))

    await store.fetchItems()

    expect(store.isLoading).toBe(false)
    expect(store.items).toEqual(['item1', 'item2'])
    expect(store.error).toBeNull()
  })
})
```

For more information on Pinia, refer to the [Pinia documentation](https://pinia.vuejs.org/introduction.html).
