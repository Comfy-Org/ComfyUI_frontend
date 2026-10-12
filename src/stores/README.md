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

## Where Stores Live

Stores are **not** all in this directory. A store lives with the domain that
owns it, following the layered architecture (`base` → `platform` → `workbench`
→ `renderer`). `src/stores/` holds the shared, cross-cutting ones that no
single domain owns.

| Location                            | Holds                                               | Examples                                                           |
| ----------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------ |
| `src/stores/`                       | Shared, cross-cutting state                         | `useCommandStore`, `useExecutionStore`, `useExtensionStore`         |
| `src/stores/workspace/`             | Workspace chrome (panels, sidebar, palette)         | `useBottomPanelStore`, `useSidebarTabStore`                        |
| `src/platform/**`                   | Platform concerns owned by their domain             | `useSettingStore`, `useWorkflowStore`, `useKeybindingStore`         |
| `src/renderer/**`                   | Canvas and rendering state                          | `useCanvasStore`, `useTitleEditorStore`, `useLinearOutputStore`     |
| `src/workbench/extensions/**`       | Extension-owned state (manager, agent)              | `useComfyManagerStore`, `useAgentPanelStore`                       |
| `src/core/**`, `src/components/**`  | Core graph concerns and a few UI primitives         | `useSelectionStore`, `useToast`                                    |

Because stores move with their domain, **the directory tree is the source of
truth**, not a list in this file. To find every store:

```bash
grep -rn "export const use\w* = defineStore" src/
```

## Core Stores

### Shared stores (`src/stores/`)

| File                         | Store                           | Description                                               | Category   |
| ---------------------------- | ------------------------------- | --------------------------------------------------------- | ---------- |
| aboutPanelStore.ts           | useAboutPanelStore              | About panel state and badges                              | UI         |
| actionBarButtonStore.ts      | useActionBarButtonStore         | Extension-contributed action bar buttons                  | UI         |
| apiKeyAuthStore.ts           | useApiKeyAuthStore              | API key authentication                                    | Auth       |
| appModeStore.ts              | useAppModeStore                 | Linear vs. graph app mode and its derived inputs          | UI         |
| assetDownloadStore.ts        | useAssetDownloadStore           | Asset download progress and lifecycle                     | Assets     |
| assetExportStore.ts          | useAssetExportStore             | Asset export tasks                                        | Assets     |
| assetsStore.ts               | useAssetsStore                  | Asset records and queries                                 | Assets     |
| authStore.ts                 | useAuthStore                    | Auth headers/tokens across Firebase, unified Cloud, API key | Auth     |
| bootstrapStore.ts            | useBootstrapStore               | Application bootstrap sequencing                          | Core       |
| comfyRegistryStore.ts        | useComfyRegistryStore           | ComfyUI registry (node packs) access                      | Registry   |
| commandStore.ts              | useCommandStore                 | Commands and command execution                            | Core       |
| dialogStore.ts               | useDialogStore                  | Dialog/modal display and state                            | UI         |
| domWidgetStore.ts            | useDomWidgetStore               | DOM widget state                                          | Widgets    |
| electronDownloadStore.ts     | useElectronDownloadStore        | Electron-specific download operations                     | Platform   |
| entityIdStore.ts             | useEntityIdStore                | Per-root-graph litegraph ID allocation state              | Graph      |
| executionErrorStore.ts       | useExecutionErrorStore          | Execution error reporting state                           | Execution  |
| executionOrderStore.ts       | useExecutionOrderStore          | Node execution order                                      | Execution  |
| executionStore.ts            | useExecutionStore               | Workflow execution state                                  | Execution  |
| extensionStore.ts            | useExtensionStore               | Extension registration and state                          | Extensions |
| graphMetadataStore.ts        | useGraphMetadataStore           | Per-root-graph `config`/`extra` and revision              | Graph      |
| helpCenterStore.ts           | useHelpCenterStore              | Help center visibility and state                          | UI         |
| jobPreviewStore.ts           | useJobPreviewStore              | Job preview state                                         | Execution  |
| linkPresentationStore.ts     | useLinkPresentationStore        | Link hidden/label presentation state                      | Graph      |
| linkStore.ts                 | useLinkStore                    | Link records                                              | Graph      |
| maskEditorDataStore.ts       | useMaskEditorDataStore          | Mask editor document data                                 | Image      |
| maskEditorStore.ts           | useMaskEditorStore              | Mask editor UI state                                      | Image      |
| menuItemStore.ts             | useMenuItemStore                | Menu items and their state                                | UI         |
| modelStore.ts                | useModelStore                   | Model information                                         | Models     |
| modelToNodeStore.ts          | useModelToNodeStore             | Maps models to compatible nodes                           | Models     |
| nodeBookmarkStore.ts         | useNodeBookmarkStore            | Node bookmarks and favorites                              | Nodes      |
| nodeDataStore.ts             | useNodeDataStore                | Per-node state (see `docs/architecture/node-data-store.md`) | Nodes    |
| nodeDefStore.ts              | useNodeDefStore                 | Node definitions and schemas                              | Nodes      |
| nodeDefStore.ts              | useNodeFrequencyStore           | Node usage frequency                                      | Nodes      |
| nodeOutputStore.ts           | useNodeOutputStore              | Node outputs and execution results                        | Media      |
| previewExposureStore.ts      | usePreviewExposureStore         | Subgraph preview exposure chains                          | Subgraph   |
| queueSettingsStore.ts        | useQueueSettingsStore           | Queue execution settings                                  | Execution  |
| queueStore.ts                | useQueueStore                   | Execution queue and task history                          | Execution  |
| queueStore.ts                | useQueuePendingTaskCountStore   | Pending task counts                                       | Execution  |
| queueStore.ts                | useQueueUIStore                 | Queue UI state                                            | Execution  |
| rerouteStore.ts              | useRerouteStore                 | Reroute point records                                     | Graph      |
| serverConfigStore.ts         | useServerConfigStore            | Server configuration                                      | Config     |
| subgraphNavigationStore.ts   | useSubgraphNavigationStore      | Subgraph navigation state                                 | Navigation |
| subgraphStore.ts             | useSubgraphStore                | Subgraph definitions                                      | Subgraph   |
| systemStatsStore.ts          | useSystemStatsStore             | System performance statistics                             | System     |
| templateInputDownloadStore.ts| useTemplateInputDownloadStore   | Template input asset downloads                            | Workflows  |
| templateRankingStore.ts      | useTemplateRankingStore         | Template ranking (see `docs/TEMPLATE_RANKING.md`)         | Workflows  |
| topbarBadgeStore.ts          | useTopbarBadgeStore             | Extension-contributed topbar badges                       | UI         |
| userFileStore.ts             | useUserFileStore                | User file operations                                      | Files      |
| userStore.ts                 | useUserStore                    | User data and preferences                                 | User       |
| widgetStore.ts               | useWidgetStore                  | Widget configurations                                     | Widgets    |
| widgetValueStore.ts          | useWidgetValueStore             | Widget values (internal — not an extension surface)       | Widgets    |
| workflowTabActivityStore.ts  | useWorkflowTabActivityStore     | Per-workflow-tab activity tracking                        | Workflows  |
| workspaceStore.ts            | useWorkspaceStore               | Overall workspace state                                   | Workspace  |

### Workspace Stores

Located in `src/stores/workspace/`:

| File                       | Store                      | Description                                 | Category |
| -------------------------- | -------------------------- | ------------------------------------------- | -------- |
| assetsSidebarBadgeStore.ts | useAssetsSidebarBadgeStore | Assets sidebar badge count                  | UI       |
| bottomPanelStore.ts        | useBottomPanelStore        | Bottom panel visibility and state           | UI       |
| colorPaletteStore.ts       | useColorPaletteStore       | Color palette configurations                | UI       |
| favoritedWidgetsStore.ts   | useFavoritedWidgetsStore   | Favorited widgets                           | UI       |
| nodeHelpStore.ts           | useNodeHelpStore           | Node help and documentation display         | UI       |
| rightSidePanelStore.ts     | useRightSidePanelStore     | Right side panel state                      | UI       |
| searchBoxStore.ts          | useSearchBoxStore          | Search box functionality                    | UI       |
| sidebarTabStore.ts         | useSidebarTabStore         | Sidebar tab states and navigation           | UI       |

### Frequently used domain-owned stores

These used to live in `src/stores/` and have moved to their owning domain:

| Store                        | Location                                                       |
| ---------------------------- | -------------------------------------------------------------- |
| useSettingStore              | `src/platform/settings/settingStore.ts`                        |
| useKeybindingStore           | `src/platform/keybindings/keybindingStore.ts`                  |
| useWorkflowStore             | `src/platform/workflow/management/stores/workflowStore.ts`     |
| useWorkflowBookmarkStore     | `src/platform/workflow/management/stores/workflowStore.ts`     |
| useWorkflowTemplatesStore    | `src/platform/workflow/templates/repositories/workflowTemplatesStore.ts` |
| useReleaseStore              | `src/platform/updates/common/releaseStore.ts`                  |
| useVersionCompatibilityStore | `src/platform/updates/common/versionCompatibilityStore.ts`     |
| useCanvasStore               | `src/renderer/core/canvas/canvasStore.ts`                      |
| useTitleEditorStore          | `src/renderer/core/canvas/canvasStore.ts`                      |
| useSelectionStore            | `src/core/selection/selectionStore.ts`                         |
| useComfyManagerStore         | `src/workbench/extensions/manager/stores/comfyManagerStore.ts` |
| useToast                     | `src/components/ui/toast/toastStore.ts`                        |

`useFirebaseAuthStore` and `useMaintenanceTaskStore` no longer exist. Auth
state is reached through `useAuthStore` (`src/stores/authStore.ts`).

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

export const useExampleStore = defineStore('example', () => {
  const items = ref([])
  const isLoading = ref(false)
  const error = ref(null)

  const itemCount = computed(() => items.value.length)
  const hasError = computed(() => error.value !== null)

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
import { nextTick } from 'vue'

import { api } from '@/scripts/api'
import { useExampleStore } from '@/stores/exampleStore'

// Mock API dependencies
vi.mock(import('@/scripts/api'), () => ({
  api: {
    getData: vi.fn()
  }
}))

describe('useExampleStore', () => {
  let store: ReturnType<typeof useExampleStore>

  beforeEach(() => {
    // The global testing Pinia is already active; just resolve the store
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
