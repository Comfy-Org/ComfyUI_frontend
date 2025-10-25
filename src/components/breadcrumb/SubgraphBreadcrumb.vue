<template>
  <div
    class="subgraph-breadcrumb w-auto drop-shadow-md"
    :class="{
      'subgraph-breadcrumb-collapse': collapseTabs,
      'subgraph-breadcrumb-overflow': overflowingTabs
    }"
    :style="{
      '--p-breadcrumb-gap': `0px`,
      '--p-breadcrumb-item-margin': `${ITEM_GAP / 2}px`,
      '--p-breadcrumb-item-min-width': `${MIN_WIDTH}px`,
      '--p-breadcrumb-item-padding': `${ITEM_PADDING}px`,
      '--p-breadcrumb-icon-width': `${ICON_WIDTH}px`
    }"
  >
    <Breadcrumb
      ref="breadcrumbRef"
      class="w-fit rounded-lg p-0"
      :model="items"
      :pt="{ item: { class: 'pointer-events-auto' } }"
      :aria-label="$t('g.graphNavigation')"
    >
      <template #item="{ item }">
        <SubgraphBreadcrumbItem
          :item="item"
          :is-active="item === items.at(-1)"
        />
      </template>
      <template #separator
        ><span style="transform: scale(1.5)"> / </span></template
      >
    </Breadcrumb>
  </div>
</template>

<script setup lang="ts">
import Breadcrumb from 'primevue/breadcrumb'
import type { MenuItem } from 'primevue/menuitem'
import { computed, onUpdated, ref, watch } from 'vue'

import SubgraphBreadcrumbItem from '@/components/breadcrumb/SubgraphBreadcrumbItem.vue'
import { useOverflowObserver } from '@/composables/element/useOverflowObserver'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useSubgraphNavigationStore } from '@/stores/subgraphNavigationStore'
import { useSubgraphStore } from '@/stores/subgraphStore'
import { forEachSubgraphNode } from '@/utils/graphTraversalUtil'

const MIN_WIDTH = 28
const ITEM_GAP = 8
const ITEM_PADDING = 8
const ICON_WIDTH = 20

const workflowStore = useWorkflowStore()
const navigationStore = useSubgraphNavigationStore()
const breadcrumbRef = ref<InstanceType<typeof Breadcrumb>>()
const workflowName = computed(() => workflowStore.activeWorkflow?.filename)
const isBlueprint = computed(() =>
  useSubgraphStore().isSubgraphBlueprint(workflowStore.activeWorkflow)
)
const collapseTabs = ref(false)
const overflowingTabs = ref(false)

const breadcrumbElement = computed(() => {
  if (!breadcrumbRef.value) return null

  const el = (breadcrumbRef.value as unknown as { $el: HTMLElement }).$el
  const list = el?.querySelector('.p-breadcrumb-list') as HTMLElement
  return list
})

const items = computed(() => {
  const items = navigationStore.navigationStack.map<MenuItem>((subgraph) => ({
    label: subgraph.name,
    command: () => {
      const canvas = useCanvasStore().getCanvas()
      if (!canvas.graph) throw new TypeError('Canvas has no graph')

      canvas.setGraph(subgraph)
    },
    updateTitle: (title: string) => {
      const rootGraph = useCanvasStore().getCanvas().graph?.rootGraph
      if (!rootGraph) return

      forEachSubgraphNode(rootGraph, subgraph.id, (node) => {
        node.title = title
      })
    }
  }))

  return [home.value, ...items]
})

const home = computed(() => ({
  label: workflowName.value,
  icon: 'pi pi-home',
  key: 'root',
  isBlueprint: isBlueprint.value,
  command: () => {
    const canvas = useCanvasStore().getCanvas()
    if (!canvas.graph) throw new TypeError('Canvas has no graph')

    canvas.setGraph(canvas.graph.rootGraph)
  }
}))

// Check for overflow on breadcrumb items and collapse/expand the breadcrumb to fit
let overflowObserver: ReturnType<typeof useOverflowObserver> | undefined
watch(breadcrumbElement, (el) => {
  overflowObserver?.dispose()
  overflowObserver = undefined

  if (!el) return

  overflowObserver = useOverflowObserver(el, {
    onCheck: (isOverflowing) => {
      overflowingTabs.value = isOverflowing

      if (collapseTabs.value) {
        // Items are currently hidden, check if we can show them
        if (!isOverflowing) {
          const items = [
            ...el.querySelectorAll('.p-breadcrumb-item')
          ] as HTMLElement[]

          if (items.length < 3) return

          const itemsWithIcon = items.filter((item) =>
            item.querySelector('.p-breadcrumb-item-link-icon-visible')
          ).length
          const separators = el.querySelectorAll(
            '.p-breadcrumb-separator'
          ) as NodeListOf<HTMLElement>
          const separator = separators[separators.length - 1] as HTMLElement
          const separatorWidth = separator.offsetWidth

          // items + separators + gaps + icons
          const itemsWidth =
            (MIN_WIDTH + ITEM_PADDING + ITEM_PADDING) * items.length +
            itemsWithIcon * ICON_WIDTH
          const separatorsWidth = (items.length - 1) * separatorWidth
          const gapsWidth = (items.length - 1) * (ITEM_GAP * 2)
          const totalWidth = itemsWidth + separatorsWidth + gapsWidth
          const containerWidth = el.clientWidth

          if (totalWidth <= containerWidth) {
            collapseTabs.value = false
          }
        }
      } else if (isOverflowing) {
        collapseTabs.value = true
      }
    }
  })
})

// If e.g. the workflow name changes, we need to check the overflow again
onUpdated(() => {
  if (!overflowObserver?.disposed.value) {
    overflowObserver?.checkOverflow()
  }
})
</script>

<style scoped>
@reference '../../assets/css/style.css';

.subgraph-breadcrumb:not(:empty) {
  flex: auto;
  flex-shrink: 10000;
  min-width: 120px;
}

.subgraph-breadcrumb,
:deep(.p-breadcrumb) {
  @apply overflow-hidden;
}

:deep(.p-breadcrumb) {
  width: 100%;
  background-color: transparent;
}

:deep(.p-breadcrumb-item) {
  @apply flex items-center overflow-hidden;
  min-width: calc(var(--p-breadcrumb-item-min-width) + 1rem);
  /* Collapse middle items first */
  flex-shrink: 10000;
}

:deep(.p-breadcrumb-separator) {
  display: flex;
  padding: 0 var(--p-breadcrumb-item-margin);
}

:deep(.p-breadcrumb-item-link) {
  padding: 0
    calc(var(--p-breadcrumb-item-margin) + var(--p-breadcrumb-item-padding));
}

:deep(.p-breadcrumb-separator),
:deep(.p-breadcrumb-item) {
  @apply h-12;
  border-top: 1px solid var(--p-panel-border-color);
  border-bottom: 1px solid var(--p-panel-border-color);
  background-color: var(--comfy-menu-bg);
}

:deep(.p-breadcrumb-item:has(.p-breadcrumb-item-link-icon-visible)) {
  min-width: calc(var(--p-breadcrumb-item-min-width) + 1rem + 20px);
}

:deep(.p-breadcrumb-item:first-child) {
  @apply rounded-l-lg;
  /* Then collapse the root workflow */
  flex-shrink: 5000;
  border-left: 1px solid var(--p-panel-border-color);

  .p-breadcrumb-item-link {
    padding-left: var(--p-breadcrumb-item-padding);
  }
}

:deep(.p-breadcrumb-item:last-child) {
  @apply rounded-r-lg;
  /* Then collapse the active item */
  flex-shrink: 1;
  border-right: 1px solid var(--p-panel-border-color);
}

:deep(.p-breadcrumb-item-link:hover),
:deep(.p-breadcrumb-item-link-menu-visible) {
  background-color: color-mix(
    in srgb,
    var(--fg-color) 10%,
    var(--comfy-menu-bg)
  ) !important;
  color: var(--fg-color);
}
</style>

<style>
@reference '../../assets/css/style.css';

.subgraph-breadcrumb-collapse .p-breadcrumb-list {
  .p-breadcrumb-item,
  .p-breadcrumb-separator {
    @apply hidden;
  }

  .p-breadcrumb-item:nth-last-child(3),
  .p-breadcrumb-separator:nth-last-child(2),
  .p-breadcrumb-item:nth-last-child(1) {
    @apply flex;
  }
}
</style>
