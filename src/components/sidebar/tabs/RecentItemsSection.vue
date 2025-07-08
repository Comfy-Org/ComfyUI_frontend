<template>
  <div v-if="hasRecentItems" class="recent-items-section">
    <div
      v-show="recentlyAddedItems.length > 0 && showRecentlyAdded"
      class="recently-added-items"
    >
      <div
        class="flex items-center cursor-pointer p-2"
        @click="toggleRecentlyAdded"
      >
        <i
          :class="[
            'pi text-sm mr-2 transition-transform',
            isRecentlyAddedExpanded ? 'pi-chevron-down' : 'pi-chevron-right'
          ]"
        />
        <span class="text-sm font-medium">{{ recentlyAddedTitle }}</span>
      </div>
      <div v-show="isRecentlyAddedExpanded" class="ml-4">
        <div class="recent-items-list">
          <div
            v-for="item in recentlyAddedItems"
            :key="item.key"
            ref="recentItemRefs"
            class="recent-item flex items-center p-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer rounded"
            @click="handleItemClick(item)"
            @mouseenter="handleItemMouseEnter($event, item)"
            @mouseleave="handleItemMouseLeave"
          >
            <div class="item-icon-container">
              <span v-if="item.image" class="item-preview-icon">
                <span
                  class="preview-image"
                  :style="{
                    backgroundImage: `url(${item.image})`
                  }"
                />
              </span>
              <i v-else :class="getItemIcon(item)" class="fallback-icon" />
            </div>
            <span class="item-label text-sm truncate">{{
              getItemLabel(item)
            }}</span>
          </div>
        </div>
      </div>
    </div>

    <div
      v-show="recentlyUsedItems.length > 0 && showRecentlyUsed"
      class="recently-used-items"
    >
      <div
        class="flex items-center cursor-pointer p-2"
        @click="toggleRecentlyUsed"
      >
        <i
          :class="[
            'pi text-sm mr-2 transition-transform',
            isRecentlyUsedExpanded ? 'pi-chevron-down' : 'pi-chevron-right'
          ]"
        />
        <span class="text-sm font-medium">{{ recentlyUsedTitle }}</span>
      </div>
      <div v-show="isRecentlyUsedExpanded" class="ml-4">
        <div class="recent-items-list">
          <div
            v-for="item in recentlyUsedItems"
            :key="item.key"
            ref="recentItemRefs"
            class="recent-item flex items-center p-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer rounded"
            @click="handleItemClick(item)"
            @mouseenter="handleItemMouseEnter($event, item)"
            @mouseleave="handleItemMouseLeave"
          >
            <div class="item-icon-container">
              <span v-if="item.image" class="item-preview-icon">
                <span
                  class="preview-image"
                  :style="{
                    backgroundImage: `url(${item.image})`
                  }"
                />
              </span>
              <i v-else :class="getItemIcon(item)" class="fallback-icon" />
            </div>
            <span class="item-label text-sm truncate">{{
              getItemLabel(item)
            }}</span>
          </div>
        </div>
      </div>
    </div>
    <Divider />

    <!-- Model Preview Teleport -->
    <teleport v-if="showModelPreview && previewTargetId" :to="previewTargetId">
      <div class="model-lib-model-preview" :style="modelPreviewStyle">
        <slot
          name="preview"
          :model-def="hoveredModel"
          :preview-ref="previewRef"
        >
          <!-- Default preview content - can be overridden by parent -->
        </slot>
      </div>
    </teleport>
  </div>
</template>
<script lang="ts">
interface RecentItem {
  key: string
  load?: () => Promise<RecentItem | void>
  image?: string
}
</script>

<script setup lang="ts" generic="T extends RecentItem">
import Divider from 'primevue/divider'
import { computed, ref } from 'vue'

import { useModelPreview } from '@/composables/sidebarTabs/useModelPreview'
import { ComfyModelDef } from '@/stores/modelStore'

interface Props<T> {
  recentlyAddedItems: T[]
  recentlyUsedItems: T[]
  showRecentlyAdded: boolean
  showRecentlyUsed: boolean
  recentlyAddedTitle: string
  recentlyUsedTitle: string
  getItemIcon: (item: T) => string
  getItemLabel: (item: T) => string
  onItemClick: (item: T) => void
  // optional model preview props
  enablePreview?: boolean
  previewTargetId?: string
  isModelItem?: (item: T) => boolean
}

const props = withDefaults(defineProps<Props<T>>(), {
  enablePreview: false,
  previewTargetId: '#model-library-model-preview-container',
  isModelItem: undefined,
  recentlyAddedItems: () => [],
  recentlyUsedItems: () => []
})

const hasRecentItems = computed(
  () =>
    (props.recentlyAddedItems.length > 0 && props.showRecentlyAdded) ||
    (props.recentlyUsedItems.length > 0 && props.showRecentlyUsed)
)

const isRecentlyAddedExpanded = ref(false)
const isRecentlyUsedExpanded = ref(false)

const toggleRecentlyAdded = () => {
  isRecentlyAddedExpanded.value = !isRecentlyAddedExpanded.value
}

const toggleRecentlyUsed = () => {
  isRecentlyUsedExpanded.value = !isRecentlyUsedExpanded.value
}

const handleItemClick = (item: T) => {
  props.onItemClick(item)
}

// Preview functionality
const {
  previewRef,
  modelPreviewStyle,
  shouldShowPreview,
  handleMouseEnter,
  handleMouseLeave
} = useModelPreview()

const recentItemRefs = ref<HTMLElement[]>([])
const hoveredModel = ref<T | null>(null)

const showModelPreview = computed(() => {
  return (
    props.enablePreview &&
    hoveredModel.value &&
    props.isModelItem &&
    props.isModelItem(hoveredModel.value) &&
    shouldShowPreview(hoveredModel.value as ComfyModelDef)
  )
})

const handleItemMouseEnter = async (event: MouseEvent, item: T) => {
  if (!props.enablePreview || !props.isModelItem) return

  const target = event.currentTarget as HTMLElement
  if (props.isModelItem(item)) {
    hoveredModel.value = item
    await handleMouseEnter(target, hoveredModel.value as ComfyModelDef)
  }
}

const handleItemMouseLeave = () => {
  if (!props.enablePreview) return

  hoveredModel.value = null
  handleMouseLeave()
}

defineExpose({
  previewRef
})
</script>

<style scoped>
.recent-items-section {
  border-bottom: 1px solid var(--p-tree-border);
  padding-bottom: 0.5rem;
  margin-bottom: 0.5rem;
}

.recent-items-list {
  max-height: 200px;
  overflow-y: auto;
}

.recent-item {
  transition: background-color 0.15s ease;
}

.recent-item:hover {
  background-color: var(--p-surface-hover);
}

.item-icon-container {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  margin-right: 8px;
  flex-shrink: 0;
}

.item-preview-icon {
  display: block;
  width: 20px;
  height: 20px;
}

.preview-image {
  display: block;
  width: 100%;
  height: 100%;
  background-size: cover;
  background-position: center;
  border-radius: 3px;
}

.fallback-icon {
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.item-label {
  flex: 1;
  min-width: 0;
}
</style>
