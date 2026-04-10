<script setup lang="ts">
import {
  useEventListener,
  useInfiniteScroll,
  useResizeObserver
} from '@vueuse/core'
import { storeToRefs } from 'pinia'
import type { ComponentPublicInstance } from 'vue'
import {
  computed,
  nextTick,
  ref,
  useTemplateRef,
  watch,
  watchEffect
} from 'vue'

import { CanvasPointer } from '@/lib/litegraph/src/CanvasPointer'
import OutputHistoryActiveQueueItem from '@/renderer/extensions/linearMode/OutputHistoryActiveQueueItem.vue'
import OutputHistoryItem from '@/renderer/extensions/linearMode/OutputHistoryItem.vue'
import { useLinearOutputStore } from '@/renderer/extensions/linearMode/linearOutputStore'
import type {
  OutputSelection,
  SelectionValue
} from '@/renderer/extensions/linearMode/linearModeTypes'
import OutputPreviewItem from '@/renderer/extensions/linearMode/OutputPreviewItem.vue'
import { useOutputHistory } from '@/renderer/extensions/linearMode/useOutputHistory'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useAppModeStore } from '@/stores/appModeStore'
import { useQueueStore } from '@/stores/queueStore'
import { cn } from '@/utils/tailwindUtil'

const {
  outputs,
  allOutputs,
  timeline,
  selectFirstHistory,
  mayBeActiveWorkflowPending
} = useOutputHistory()
const { hasOutputs } = storeToRefs(useAppModeStore())
const queueStore = useQueueStore()
const store = useLinearOutputStore()
const workflowStore = useWorkflowStore()

const emit = defineEmits<{
  updateSelection: [selection: OutputSelection]
}>()

const queueCount = computed(
  () => queueStore.runningTasks.length + queueStore.pendingTasks.length
)

const itemClass = cn(
  'shrink-0 cursor-pointer rounded-lg border-2 border-transparent p-1 outline-none',
  'relative data-[state=checked]:border-interface-panel-job-progress-border'
)

const hasActiveContent = computed(
  () => store.activeWorkflowInProgressItems.length > 0
)

const selectableItems = computed(() => {
  const items: SelectionValue[] = []
  if (mayBeActiveWorkflowPending.value) {
    items.push({ id: 'slot:pending', kind: 'inProgress', itemId: 'pending' })
  }
  for (const item of store.activeWorkflowInProgressItems) {
    items.push({
      id: `slot:${item.id}`,
      kind: 'inProgress',
      itemId: item.id
    })
  }
  for (const entry of timeline.value) {
    items.push(entry.selectionValue)
  }
  return items
})

const selectionMap = computed(
  () => new Map(selectableItems.value.map((v) => [v.id, v]))
)

const selectedValue = computed(() => {
  if (!store.selectedId) return undefined
  return selectionMap.value.get(store.selectedId)
})

function itemAttrs(id: string) {
  const selected = store.selectedId === id
  return {
    'data-state': selected ? 'checked' : 'unchecked',
    tabindex: selected ? 0 : -1
  }
}

const selectedItemEl = ref<Element | null>(null)

function selectedRef(id: string) {
  return store.selectedId === id
    ? (el: Element | ComponentPublicInstance | null) => {
        selectedItemEl.value = el instanceof Element ? el : null
      }
    : undefined
}

function doEmit() {
  const sel = selectedValue.value
  if (!sel) {
    emit('updateSelection', { canShowPreview: true })
    return
  }
  if (sel.kind === 'inProgress') {
    const item = store.activeWorkflowInProgressItems.find(
      (i) => i.id === sel.itemId
    )
    if (!item || item.state === 'skeleton') {
      emit('updateSelection', { canShowPreview: true, showSkeleton: true })
    } else if (item.state === 'latent') {
      emit('updateSelection', {
        canShowPreview: true,
        latentPreviewUrl: item.latentPreviewUrl
      })
    } else {
      emit('updateSelection', {
        output: item.output,
        canShowPreview: true
      })
    }
    return
  }
  if (sel.kind === 'nonAsset') {
    const entry = store.activeWorkflowNonAssetOutputs.find(
      (e) => e.id === sel.itemId
    )
    emit('updateSelection', {
      output: entry?.output,
      canShowPreview: true
    })
    return
  }
  const asset = outputs.media.value.find((a) => a.id === sel.assetId)
  const output = asset ? allOutputs(asset)[sel.key] : undefined
  const isFirst = outputs.media.value[0]?.id === sel.assetId
  emit('updateSelection', {
    asset,
    output,
    canShowPreview: isFirst
  })
}

watchEffect(doEmit)

// On load or workflow tab switch, select the most recent item.
// Prefer in-progress items for this workflow, then history, skipping
// the global pending slot which may belong to another workflow.
watch(
  () => workflowStore.activeWorkflow?.path,
  (path) => {
    if (!path) return
    const inProgress = store.activeWorkflowInProgressItems
    if (inProgress.length > 0) {
      store.selectAsLatest(`slot:${inProgress[0].id}`)
    } else if (hasOutputs.value) {
      selectFirstHistory()
    } else {
      store.selectAsLatest(null)
    }
  },
  { immediate: true }
)

// Keep history selection stable on media changes
watch(
  () => outputs.media.value,
  (newAssets, oldAssets) => {
    if (
      newAssets.length === oldAssets.length ||
      (oldAssets.length === 0 && newAssets.length !== 1)
    )
      return

    if (store.selectedId?.startsWith('slot:')) return

    const sv = store.selectedId
      ? selectionMap.value.get(store.selectedId)
      : undefined

    if (!sv || (sv.kind !== 'history' && sv.kind !== 'nonAsset')) {
      if (hasOutputs.value) selectFirstHistory()
      return
    }

    // Non-asset selections are stable — don't override them
    if (sv.kind === 'nonAsset') return

    const assetGone = !newAssets.some((a) => a.id === sv.assetId)
    if (assetGone) {
      if (hasOutputs.value) selectFirstHistory()
      return
    }

    const wasFirst = sv.assetId === oldAssets[0]?.id
    if (wasFirst && hasOutputs.value) {
      const firstId = `history:${newAssets[0].id}:0`
      store.autoSelectLatest(firstId)
    }
  }
)

const outputsRef = useTemplateRef('outputsRef')

// Track scrollWidth so we can compensate when items are prepended on the left.
let lastScrollWidth = 0
useResizeObserver(outputsRef, () => {
  lastScrollWidth = outputsRef.value?.scrollWidth ?? 0
})
watch(
  [
    () => store.activeWorkflowInProgressItems.length,
    () => timeline.value[0]?.id,
    queueCount
  ],
  () => {
    const el = outputsRef.value
    if (!el || el.scrollLeft === 0) {
      lastScrollWidth = el?.scrollWidth ?? 0
      return
    }
    nextTick(() => {
      const delta = el.scrollWidth - lastScrollWidth
      if (delta !== 0) el.scrollLeft += delta
      lastScrollWidth = el.scrollWidth
    })
  }
)

useInfiniteScroll(outputsRef, outputs.loadMore, {
  canLoadMore: () => outputs.hasMore.value
})

function navigateToAdjacent(direction: 1 | -1) {
  const items = selectableItems.value
  if (items.length === 0) return
  const currentId = store.selectedId
  const idx = currentId ? items.findIndex((i) => i.id === currentId) : -1
  const nextIdx =
    idx === -1 ? 0 : Math.max(0, Math.min(items.length - 1, idx + direction))
  store.select(items[nextIdx].id)
  nextTick(() => {
    selectedItemEl.value?.scrollIntoView({
      block: 'nearest',
      inline: 'nearest'
    })
  })
}

const pointer = new CanvasPointer(document.body)
let scrollOffset = 0
useEventListener(
  document.body,
  'wheel',
  function (e: WheelEvent) {
    if (!e.ctrlKey && !e.metaKey) return
    e.preventDefault()
    e.stopPropagation()

    if (!pointer.isTrackpadGesture(e)) {
      if (e.deltaY > 0) navigateToAdjacent(1)
      else navigateToAdjacent(-1)
      return
    }
    scrollOffset += e.deltaY
    while (scrollOffset >= 60) {
      scrollOffset -= 60
      navigateToAdjacent(1)
    }
    while (scrollOffset <= -60) {
      scrollOffset += 60
      navigateToAdjacent(-1)
    }
  },
  { capture: true, passive: false }
)

useEventListener(
  outputsRef,
  'wheel',
  function (e: WheelEvent) {
    if (e.ctrlKey || e.metaKey || e.deltaY === 0) return
    e.preventDefault()
    if (outputsRef.value) outputsRef.value.scrollLeft += e.deltaY
  },
  { passive: false }
)

const keyHandlers: Record<string, 1 | -1> = {
  ArrowUp: -1,
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowRight: 1
}
useEventListener(document.body, 'keydown', (e: KeyboardEvent) => {
  if (
    !(e.key in keyHandlers) ||
    e.target instanceof HTMLTextAreaElement ||
    e.target instanceof HTMLInputElement
  )
    return

  e.preventDefault()
  e.stopPropagation()
  navigateToAdjacent(keyHandlers[e.key])
})
</script>
<template>
  <div
    role="group"
    class="flex h-21 min-w-0 items-start justify-center px-4 py-3 pb-4"
  >
    <div
      v-if="queueCount > 0 || hasActiveContent"
      class="flex h-15 shrink-0 items-start gap-0.5"
    >
      <OutputHistoryActiveQueueItem
        v-if="queueCount > 1 || queueStore.pendingTasks.length"
        class="mr-3"
        :queue-count="queueCount"
      />

      <div
        v-if="mayBeActiveWorkflowPending"
        :ref="selectedRef('slot:pending')"
        v-bind="itemAttrs('slot:pending')"
        :class="itemClass"
        @click="store.select('slot:pending')"
      >
        <OutputPreviewItem />
      </div>

      <div
        v-for="item in store.activeWorkflowInProgressItems"
        :key="`${item.id}-${item.state}`"
        :ref="selectedRef(`slot:${item.id}`)"
        v-bind="itemAttrs(`slot:${item.id}`)"
        :class="itemClass"
        @click="store.select(`slot:${item.id}`)"
      >
        <OutputPreviewItem
          v-if="item.state !== 'image' || !item.output"
          :latent-preview="item.latentPreviewUrl"
        />
        <OutputHistoryItem v-else :output="item.output" />
      </div>

      <div
        v-if="hasActiveContent && timeline.length > 0"
        class="mx-4 h-12 shrink-0 border-l border-border-default"
      />
    </div>

    <article
      ref="outputsRef"
      data-testid="linear-outputs"
      class="min-w-0 overflow-x-auto overflow-y-clip"
    >
      <div class="flex h-15 w-fit items-start gap-0.5">
        <template v-for="(item, idx) in timeline" :key="item.id">
          <div
            v-if="idx > 0 && item.groupKey !== timeline[idx - 1].groupKey"
            class="mx-4 h-12 shrink-0 border-l border-border-default"
          />
          <div
            :ref="selectedRef(item.id)"
            v-bind="itemAttrs(item.id)"
            :class="itemClass"
            @click="store.select(item.id)"
          >
            <OutputHistoryItem :output="item.output" />
          </div>
        </template>
      </div>
    </article>
  </div>
</template>
