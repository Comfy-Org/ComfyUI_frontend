<template>
  <div
    v-if="workflowStore.isSubgraphActive"
    class="py-2 subgraph-breadcrumb w-full"
    :class="{
      'subgraph-breadcrumb-collapse': collapseTabs,
      'subgraph-breadcrumb-overflow': overflowingTabs
    }"
    :style="{
      '--p-breadcrumb-gap': `${ITEM_GAP}px`,
      '--p-breadcrumb-item-min-width': `${MIN_WIDTH}px`
    }"
  >
    <Breadcrumb
      ref="breadcrumbRef"
      class="bg-transparent"
      :home="home"
      :model="items"
      aria-label="Graph navigation"
    >
      <template #item="{ item }">
        <a
          v-tooltip.bottom="item.label"
          href="#"
          class="cursor-pointer p-breadcrumb-item-link"
          @click="(event) => item.command?.({ item, originalEvent: event })"
        >
          <i
            v-if="item.icon"
            :class="item.icon"
            class="p-breadcrumb-item-icon"
          />
          <span class="p-breadcrumb-item-label">{{ item.label }}</span>
        </a>
      </template>
      <template #separator
        ><span style="transform: scale(1.5)"> / </span></template
      >
    </Breadcrumb>
  </div>
</template>

<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import Breadcrumb from 'primevue/breadcrumb'
import type { MenuItem } from 'primevue/menuitem'
import { computed, onUpdated, ref, watch } from 'vue'

import { useOverflowObserver } from '@/composables/element/useOverflowObserver'
import { useCanvasStore } from '@/stores/graphStore'
import { useSubgraphNavigationStore } from '@/stores/subgraphNavigationStore'
import { useWorkflowStore } from '@/stores/workflowStore'

const MIN_WIDTH = 28
const ITEM_GAP = 8

const workflowStore = useWorkflowStore()
const navigationStore = useSubgraphNavigationStore()
const breadcrumbRef = ref<InstanceType<typeof Breadcrumb>>()
const workflowName = computed(() => workflowStore.activeWorkflow?.filename)
const collapseTabs = ref(false)
const overflowingTabs = ref(false)

const breadcrumbElement = computed(() => {
  if (!breadcrumbRef.value) return null

  const el = (breadcrumbRef.value as unknown as { $el: HTMLElement }).$el
  const list = el?.querySelector('.p-breadcrumb-list') as HTMLElement
  return list
})

const items = computed(() => {
  if (!navigationStore.navigationStack.length) return []

  const items = navigationStore.navigationStack.map<MenuItem>((subgraph) => ({
    label: subgraph.name,
    command: () => {
      const canvas = useCanvasStore().getCanvas()
      if (!canvas.graph) throw new TypeError('Canvas has no graph')

      canvas.setGraph(subgraph)
    }
  }))

  return [...items]
})

const home = computed(() => ({
  label: workflowName.value,
  icon: 'pi pi-home',
  command: () => {
    const canvas = useCanvasStore().getCanvas()
    if (!canvas.graph) throw new TypeError('Canvas has no graph')

    canvas.setGraph(canvas.graph.rootGraph)
  }
}))

// Escape exits from the current subgraph.
useEventListener(document, 'keydown', (event) => {
  if (event.key === 'Escape') {
    const canvas = useCanvasStore().getCanvas()
    if (!canvas.graph) throw new TypeError('Canvas has no graph')

    canvas.setGraph(
      navigationStore.navigationStack.at(-2) ?? canvas.graph.rootGraph
    )
  }
})

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

          const separators = el.querySelectorAll(
            '.p-breadcrumb-separator'
          ) as NodeListOf<HTMLElement>
          const separator = separators[separators.length - 1] as HTMLElement
          const separatorWidth = separator.offsetWidth

          // items + separators + gaps + home icon
          const itemsWidth = MIN_WIDTH * items.length + 20
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
.subgraph-breadcrumb:not(:empty) {
  min-width: 120px;
}

.subgraph-breadcrumb,
:deep(.p-breadcrumb),
:deep(.p-breadcrumb-item) {
  @apply overflow-hidden;
}

:deep(.p-breadcrumb-item:first-child) {
  min-width: calc(var(--p-breadcrumb-item-min-width) + 20px);
}

:deep(.p-breadcrumb-item) {
  min-width: var(--p-breadcrumb-item-min-width);
}

:deep(.p-breadcrumb-item-link),
:deep(.p-breadcrumb-item-icon) {
  @apply select-none;
}

:deep(.p-breadcrumb-item-label) {
  @apply whitespace-nowrap text-ellipsis overflow-hidden min-w-8;
}
</style>

<style>
.subgraph-breadcrumb-collapse .p-breadcrumb-list {
  .p-breadcrumb-item,
  .p-breadcrumb-separator {
    display: none;
  }

  /* .p-breadcrumb-item:first-child, */
  /* .p-breadcrumb-item:first-child+.p-breadcrumb-separator, */
  .p-breadcrumb-item:nth-last-child(3),
  .p-breadcrumb-separator:nth-last-child(2),
  .p-breadcrumb-item:nth-last-child(1) {
    display: block;
  }
}
</style>
