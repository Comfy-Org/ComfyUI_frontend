<template>
  <div
    data-testid="subgraph-breadcrumb"
    :data-collapsed="collapseTabs || undefined"
    class="flex w-auto min-w-30 flex-auto shrink-10000 items-center overflow-hidden drop-shadow-(--interface-panel-drop-shadow)"
    :style="{
      '--breadcrumb-item-margin': `${ITEM_GAP / 2}px`,
      '--breadcrumb-item-min-width': `${MIN_WIDTH}px`,
      '--breadcrumb-item-padding': `${ITEM_PADDING}px`
    }"
  >
    <WorkflowActionsDropdown
      v-if="!canvasStore.linearMode"
      source="breadcrumb_subgraph_menu_selected"
    />
    <Button
      v-if="isInSubgraph"
      class="pointer-events-auto ml-1.5 size-8 shrink-0 border border-transparent bg-transparent p-0 transition-all hover:rounded-lg hover:border-border hover:bg-comfy-menu-bg"
      data-testid="subgraph-breadcrumb-back"
      variant="muted-textonly"
      size="icon"
      @click="handleBackClick"
    >
      <i class="icon-[lucide--undo-2]" />
    </Button>
    <nav
      :class="
        cn(
          'w-full overflow-hidden rounded-lg bg-transparent p-0',
          !isInSubgraph && 'hidden'
        )
      "
      :aria-label="$t('g.graphNavigation')"
    >
      <ol
        ref="breadcrumbListRef"
        :class="
          cn(
            'm-0 flex list-none items-center p-0 text-muted-foreground',
            collapseTabs && '[&>li]:hidden [&>li:nth-last-child(-n+3)]:flex'
          )
        "
      >
        <template v-for="(item, index) in items" :key="item.key">
          <li
            data-breadcrumb-item
            class="pointer-events-auto flex h-8 min-w-[calc(var(--breadcrumb-item-min-width)+1rem)] shrink-10000 items-center overflow-hidden border border-transparent bg-transparent transition-all duration-200 first:shrink-5000 last:shrink hover:rounded-lg hover:border-border hover:bg-comfy-menu-bg hover:text-base-foreground has-data-active:min-w-[calc(var(--breadcrumb-item-min-width)+1rem+20px)]"
          >
            <SubgraphBreadcrumbItem
              :item
              :is-active="item.key === activeItemKey"
            />
          </li>
          <li
            v-if="index < items.length - 1"
            data-breadcrumb-separator
            class="flex border border-transparent bg-transparent px-(--breadcrumb-item-margin)"
            aria-hidden="true"
          >
            <span class="scale-150">/</span>
          </li>
        </template>
      </ol>
    </nav>
  </div>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { computed, onBeforeUnmount, onMounted, onUpdated, ref } from 'vue'

import SubgraphBreadcrumbItem from '@/components/breadcrumb/SubgraphBreadcrumbItem.vue'
import type { BreadcrumbItem } from '@/components/breadcrumb/SubgraphBreadcrumbItem.vue'
import WorkflowActionsDropdown from '@/components/common/WorkflowActionsDropdown.vue'
import Button from '@/components/ui/button/Button.vue'
import { useOverflowObserver } from '@/composables/element/useOverflowObserver'
import { useTelemetry } from '@/platform/telemetry'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useCommandStore } from '@/stores/commandStore'
import { useSubgraphNavigationStore } from '@/stores/subgraphNavigationStore'
import { useSubgraphStore } from '@/stores/subgraphStore'
import { forEachSubgraphNode } from '@/utils/graphTraversalUtil'

const MIN_WIDTH = 28
const ITEM_GAP = 8
const ITEM_PADDING = 8
const ICON_WIDTH = 20

const workflowStore = useWorkflowStore()
const navigationStore = useSubgraphNavigationStore()
const canvasStore = useCanvasStore()
const breadcrumbListRef = ref<HTMLElement | null>(null)
const workflowName = computed(() => workflowStore.activeWorkflow?.filename)
const isBlueprint = computed(() =>
  useSubgraphStore().isSubgraphBlueprint(workflowStore.activeWorkflow)
)
const collapseTabs = ref(false)

const isInSubgraph = computed(() => navigationStore.navigationStack.length > 0)

const home = computed(() => ({
  label: workflowName.value,
  icon: 'pi pi-home',
  key: 'root',
  isBlueprint: isBlueprint.value,
  command: () => {
    useTelemetry()?.trackUiButtonClicked({
      button_id: 'breadcrumb_subgraph_root_selected',
      element_group: 'breadcrumb'
    })
    const canvas = canvasStore.getCanvas()
    if (!canvas.graph) throw new TypeError('Canvas has no graph')

    canvas.setGraph(canvas.graph.rootGraph)
  }
}))

const items = computed(() => {
  const items = navigationStore.navigationStack.map<BreadcrumbItem>(
    (subgraph) => ({
      label: subgraph.name,
      key: `subgraph-${subgraph.id}`,
      command: () => {
        useTelemetry()?.trackUiButtonClicked({
          button_id: 'breadcrumb_subgraph_item_selected',
          element_group: 'breadcrumb'
        })
        const canvas = canvasStore.getCanvas()
        if (!canvas.graph) throw new TypeError('Canvas has no graph')

        canvas.setGraph(subgraph)
      },
      updateTitle: (title: string) => {
        const rootGraph = canvasStore.getCanvas().graph?.rootGraph
        if (!rootGraph) return

        forEachSubgraphNode(rootGraph, subgraph.id, (node) => {
          node.title = title
        })
      }
    })
  )

  return [home.value, ...items]
})

const activeItemKey = computed(() => items.value.at(-1)?.key)

const handleBackClick = () => {
  void useCommandStore().execute('Comfy.Graph.ExitSubgraph')
}

let overflowObserver: ReturnType<typeof useOverflowObserver> | undefined
onMounted(() => {
  const el = breadcrumbListRef.value
  if (!el) return

  overflowObserver = useOverflowObserver(el, {
    onCheck: (isOverflowing) => {
      if (collapseTabs.value) {
        if (!isOverflowing) {
          const items = [
            ...el.querySelectorAll<HTMLElement>('[data-breadcrumb-item]')
          ]

          if (items.length < 3) return

          const itemsWithIcon = items.filter((item) =>
            item.querySelector('[data-active]')
          ).length
          const separators = el.querySelectorAll<HTMLElement>(
            '[data-breadcrumb-separator]'
          )
          const separator = separators[separators.length - 1]
          const separatorWidth = separator.offsetWidth

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

onBeforeUnmount(() => overflowObserver?.dispose())

onUpdated(() => {
  if (!overflowObserver?.disposed.value) {
    overflowObserver?.checkOverflow()
  }
})
</script>
