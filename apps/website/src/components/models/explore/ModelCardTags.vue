<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import TagRow from '../../hub/TagRow.vue'
import Badge from '../../ui/badge/Badge.vue'
import type { CardWorkflowItem } from './ModelExploreCard.vue'
const { item, variant, styles } = defineProps<{
  item: CardWorkflowItem
  variant: 'compact' | 'feature' | 'hub'
  styles: { tag: string; tags: string }
}>()
</script>
<template>
  <div
    v-if="variant !== 'compact' && item.taskLabel"
    class="mt-auto flex h-6 min-w-0 items-center gap-1.5"
  >
    <span
      :class="
        cn(
          'inline-flex w-fit items-center justify-center rounded-full',
          styles.tag
        )
      "
      >{{ item.taskLabel }}</span
    >
    <TagRow
      :tags="item.capabilities ?? []"
      :link-tags="false"
      :collapse-tags="variant === 'hub'"
      title-case-labels
      class="min-w-0 flex-1"
    />
  </div>
  <div v-else-if="variant === 'hub'" class="mt-auto min-w-0">
    <TagRow
      :tags="item.tags ?? []"
      :link-tags="false"
      collapse-tags
      title-case-labels
    />
  </div>
  <div v-else :class="cn('mt-auto flex', styles.tags)">
    <Badge
      v-for="tag in item.tags"
      :key="tag"
      variant="subtle"
      :class="styles.tag"
      >{{ tag }}</Badge
    >
  </div>
</template>
