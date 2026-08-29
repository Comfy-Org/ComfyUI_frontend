<template>
  <div
    class="option-container flex w-full cursor-pointer items-center justify-between overflow-hidden px-2 py-0"
  >
    <div class="option-display-name flex flex-col font-semibold">
      <div>
        <span v-if="isBookmarked">
          <i class="pi pi-bookmark-fill mr-1 text-sm" />
        </span>
        <span>
          <HighlightedText :text="nodeDef.display_name" :query="currentQuery" />
        </span>
        <span>&nbsp;</span>
        <Badge v-if="showIdName" severity="secondary">
          <span>
            <HighlightedText :text="nodeDef.name" :query="currentQuery" />
          </span>
        </Badge>
      </div>
      <div
        v-if="showCategory"
        class="option-category truncate text-sm font-light text-muted"
      >
        {{ nodeDef.category.replaceAll('/', ' > ') }}
      </div>
    </div>
    <div class="option-badges">
      <Badge
        v-if="nodeDef.deprecated"
        :value="$t('g.deprecated')"
        severity="danger"
      />
      <Badge
        v-if="nodeDef.experimental"
        :value="$t('g.experimental')"
        severity="primary"
      />
      <Badge v-if="nodeDef.dev_only" :value="$t('g.devOnly')" severity="info" />
      <Badge
        v-if="showNodeFrequency && nodeFrequency > 0"
        :value="formatNumberWithSuffix(nodeFrequency, { roundToInt: true })"
        severity="secondary"
      />
      <Badge
        v-if="nodeDef.nodeSource.type !== NodeSourceType.Unknown"
        variant="chip"
        class="text-sm font-light"
      >
        {{ nodeDef.nodeSource.displayText }}
      </Badge>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import HighlightedText from '@/components/searchbox/HighlightedText.vue'
import Badge from '@/components/ui/badge/Badge.vue'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useNodeBookmarkStore } from '@/stores/nodeBookmarkStore'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import { useNodeFrequencyStore } from '@/stores/nodeDefStore'
import { NodeSourceType } from '@/types/nodeSource'
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
  font-weight: 700;
  border-radius: 0.25rem;
  padding: 0 0.125rem;
  margin: -0.125rem 0.125rem;
}
</style>
