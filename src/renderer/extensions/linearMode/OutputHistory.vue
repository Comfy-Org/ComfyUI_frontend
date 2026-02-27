<script setup lang="ts">
import { useEventListener, useInfiniteScroll } from '@vueuse/core'
import type { ComponentPublicInstance } from 'vue'
import {
  computed,
  nextTick,
  ref,
  toValue,
  useTemplateRef,
  watch,
  watchEffect
} from 'vue'

import { CanvasPointer } from '@/lib/litegraph/src/CanvasPointer'
import { getOutputAssetMetadata } from '@/platform/assets/schemas/assetMetadataSchema'
import OutputHistoryActiveQueueItem from '@/renderer/extensions/linearMode/OutputHistoryActiveQueueItem.vue'
import OutputHistoryItem from '@/renderer/extensions/linearMode/OutputHistoryItem.vue'
import { useLinearOutputStore } from '@/renderer/extensions/linearMode/linearOutputStore'
import type {
  OutputSelection,
  SelectionValue
} from '@/renderer/extensions/linearMode/linearModeTypes'
import OutputPreviewItem from '@/renderer/extensions/linearMode/OutputPreviewItem.vue'
import { useOutputHistory } from '@/renderer/extensions/linearMode/useOutputHistory'
import { useQueueStore } from '@/stores/queueStore'
import { cn } from '@/utils/tailwindUtil'

const { outputs, allOutputs } = useOutputHistory()
const queueStore = useQueueStore()
const store = useLinearOutputStore()

const emit = defineEmits<{
  updateSelection: [selection: OutputSelection]
}>()

const queueCount = computed(
  () => queueStore.runningTasks.length + queueStore.pendingTasks.length
)

const itemClass = cn(
  'shrink-0 cursor-pointer p-1 rounded-lg border-2 border-transparent outline-none',
  'data-[state=checked]:border-interface-panel-job-progress-border'
)

const hasActiveContent = computed(() => store.inProgressItems.length > 0)

const visibleHistory = computed(() =>
  outputs.media.value.filter((a) => toValue(allOutputs(a)).length > 0)
)

const selectableItems = computed(() => {
  const items: SelectionValue[] = []
  for (const item of store.inProgressItems) {
    items.push({
      id: `slot:${item.id}`,
      kind: 'inProgress',
      itemId: item.id
    })
  }
  for (const asset of outputs.media.value) {
    const outs = toValue(allOutputs(asset))
    for (let k = 0; k < outs.length; k++) {
      items.push({
        id: `history:${asset.id}:${k}`,
        kind: 'history',
        assetId: asset.id,
        key: k
      })
    }
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
    const item = store.inProgressItems.find((i) => i.id === sel.itemId)
    if (!item || item.state === 'skeleton') {
      emit('updateSelection', { canShowPreview: true })
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
  const asset = outputs.media.value.find((a) => a.id === sel.assetId)
  const output = asset ? toValue(allOutputs(asset))[sel.key] : undefined
  const isFirst = outputs.media.value[0]?.id === sel.assetId
  emit('updateSelection', {
    asset,
    output,
    canShowPreview: isFirst
  })
}

watchEffect(doEmit)

// Resolve in-progress items only when history outputs are loaded.
// Using watchEffect so it re-runs when allOutputs refs resolve (async).
watchEffect(() => {
  if (store.pendingResolve.size === 0) return
  for (const jobId of store.pendingResolve) {
    const asset = outputs.media.value.find((a) => {
      const m = getOutputAssetMetadata(a?.user_metadata)
      return m?.jobId === jobId
    })
    if (!asset) continue
    const loaded = toValue(allOutputs(asset)).length > 0
    if (loaded) {
      store.resolveIfReady(jobId, true)
      if (!store.selectedId) selectFirstHistory()
    }
  }
})

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

    if (!sv || sv.kind !== 'history') {
      selectFirstHistory()
      return
    }

    const wasFirst = sv.assetId === oldAssets[0]?.id
    if (wasFirst || !newAssets.some((a) => a.id === sv.assetId)) {
      selectFirstHistory()
    }
  }
)

function selectFirstHistory() {
  const first = outputs.media.value[0]
  if (first) {
    store.selectAsLatest(`history:${first.id}:0`)
  } else {
    store.selectAsLatest(null)
  }
}

// Compensate scroll position when items are prepended on the left.
watch(
  [
    () => store.inProgressItems.length,
    () => visibleHistory.value[0]?.id,
    queueCount
  ],
  () => {
    const el = outputsRef.value
    if (!el || el.scrollLeft === 0) return
    const prevScrollWidth = el.scrollWidth
    nextTick(() => {
      const delta = el.scrollWidth - prevScrollWidth
      if (delta !== 0) el.scrollLeft += delta
    })
  }
)

const outputsRef = useTemplateRef('outputsRef')
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
  <div role="group" class="min-w-0 px-4 pb-4">
    <article
      ref="outputsRef"
      data-testid="linear-outputs"
      class="py-3 overflow-y-clip overflow-x-auto min-w-0"
    >
      <div class="flex items-center gap-0.5 mx-auto w-fit">
        <div
          v-if="queueCount > 0 || hasActiveContent"
          :class="
            cn(
              'sticky left-0 z-10 shrink-0 flex items-center gap-0.5',
              'bg-comfy-menu-bg md:bg-comfy-menu-secondary-bg'
            )
          "
        >
          <div v-if="queueCount > 0" class="shrink-0 flex items-center gap-0.5">
            <OutputHistoryActiveQueueItem :queue-count="queueCount" />
            <div
              v-if="hasActiveContent || visibleHistory.length > 0"
              class="border-l border-border-default h-12 shrink-0 mx-4"
            />
          </div>

          <div
            v-for="item in store.inProgressItems"
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
            v-if="hasActiveContent && visibleHistory.length > 0"
            class="border-l border-border-default h-12 shrink-0 mx-4"
          />
        </div>

        <template v-for="(asset, aIdx) in visibleHistory" :key="asset.id">
          <div
            v-if="aIdx > 0"
            class="border-l border-border-default h-12 shrink-0 mx-4"
          />
          <div
            v-for="(output, key) in toValue(allOutputs(asset))"
            :key
            :ref="selectedRef(`history:${asset.id}:${key}`)"
            v-bind="itemAttrs(`history:${asset.id}:${key}`)"
            :class="itemClass"
            @click="store.select(`history:${asset.id}:${key}`)"
          >
            <OutputHistoryItem :output="output" />
          </div>
        </template>
      </div>
    </article>
  </div>
</template>
