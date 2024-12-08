<template>
  <div
    class="option-container flex justify-between items-center px-2 py-0 cursor-pointer overflow-hidden w-full"
  >
    <div class="option-display-name font-semibold flex flex-col">
      <div>
        <span v-if="isBookmarked">
          <i class="pi pi-bookmark-fill text-sm mr-1"></i>
        </span>
        <span
          v-html="highlightQuery(nodeDef.display_name, currentQuery)"
        ></span>
        <span>&nbsp;</span>
        <Tag v-if="showIdName" severity="secondary">
          <span v-html="highlightQuery(nodeDef.name, currentQuery)"></span>
        </Tag>
      </div>
      <div
        v-if="showCategory"
        class="option-category font-light text-sm text-gray-400 overflow-hidden text-ellipsis whitespace-nowrap"
      >
        {{ nodeDef.category.replaceAll('/', ' > ') }}
      </div>
    </div>
    <div class="option-badges">
      <Tag
        v-if="nodeDef.experimental"
        :value="$t('g.experimental')"
        severity="primary"
      />
      <Tag
        v-if="nodeDef.deprecated"
        :value="$t('g.deprecated')"
        severity="danger"
      />
      <Tag
        v-if="showNodeFrequency && nodeFrequency > 0"
        :value="formatNumberWithSuffix(nodeFrequency, { roundToInt: true })"
        severity="secondary"
      />
      <Chip
        v-if="nodeDef.nodeSource.type !== NodeSourceType.Unknown"
        class="text-sm font-light"
      >
        {{ nodeDef.nodeSource.displayText }}
      </Chip>
    </div>
  </div>
</template>

<script setup lang="ts">
import Tag from 'primevue/tag'
import Chip from 'primevue/chip'
import { NodeSourceType } from '@/types/nodeSource'
import { ComfyNodeDefImpl, useNodeFrequencyStore } from '@/stores/nodeDefStore'
import { highlightQuery } from '@/utils/formatUtil'
import { computed } from 'vue'
import { useSettingStore } from '@/stores/settingStore'
import { useNodeBookmarkStore } from '@/stores/nodeBookmarkStore'
import { formatNumberWithSuffix } from '@/utils/formatUtil'

const settingStore = useSettingStore()
const showCategory = computed(() =>
  settingStore.get('Comfy.NodeSearchBoxImpl.ShowCategory')
)
const showIdName = computed(() =>
  settingStore.get('Comfy.NodeSearchBoxImpl.ShowIdName')
)
const showNodeFrequency = computed(() =>
  settingStore.get('Comfy.NodeSearchBoxImpl.ShowNodeFrequency')
)
const nodeFrequencyStore = useNodeFrequencyStore()
const nodeFrequency = computed(() =>
  nodeFrequencyStore.getNodeFrequency(props.nodeDef)
)

const nodeBookmarkStore = useNodeBookmarkStore()
const isBookmarked = computed(() =>
  nodeBookmarkStore.isBookmarked(props.nodeDef)
)

const props = defineProps<{
  nodeDef: ComfyNodeDefImpl
  currentQuery: string
}>()
</script>

<style scoped>
:deep(.highlight) {
  background-color: var(--p-primary-color);
  color: var(--p-primary-contrast-color);
  font-weight: bold;
  border-radius: 0.25rem;
  padding: 0rem 0.125rem;
  margin: -0.125rem 0.125rem;
}
</style>
