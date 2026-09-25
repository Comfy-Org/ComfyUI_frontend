<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import Tooltip from '@/components/ui/tooltip/Tooltip.vue'
import { buildTooltipConfig } from '@/composables/useTooltipConfig'

import type { SelectedNode } from '../../../composables/agent/useCanvasSelection'
import { selectedNodeKey } from '../../../composables/agent/useCanvasSelection'

const { tags, graphDupes, tagDupes, duplicateIdClass } = defineProps<{
  tags: SelectedNode[]
  graphDupes: Set<string>
  tagDupes: Set<string>
  duplicateIdClass: string
}>()
const emit = defineEmits<{ remove: [id: string] }>()
const { t } = useI18n()
</script>

<template>
  <div
    data-testid="composer-node-section"
    class="flex flex-wrap items-center gap-2 border-b border-border-default p-3"
  >
    <span
      v-for="tag in tags"
      :key="selectedNodeKey(tag)"
      class="inline-flex h-7 items-center gap-1 rounded-lg border border-border-default bg-secondary-background-hover px-2.5 text-xs/4 font-medium text-base-foreground transition-colors hover:bg-tertiary-background-hover"
    >
      <span class="flex items-center gap-1">
        <span class="icon-[comfy--node] size-3.5 text-muted-foreground" />
        <span class="max-w-40 truncate">{{ tag.title }}</span>
        <span
          v-if="graphDupes.has(tag.title) || tagDupes.has(tag.title)"
          :class="duplicateIdClass"
          >#{{ tag.id }}</span
        >
      </span>
      <Tooltip :config="buildTooltipConfig(t('agent.remove'))" side="top">
        <Button
          type="button"
          variant="muted-textonly"
          size="unset"
          :aria-label="
            t('agent.removeNodeLabel', { node: `${tag.title} #${tag.id}` })
          "
          class="size-3.5"
          @click.stop="emit('remove', selectedNodeKey(tag))"
        >
          <span class="icon-[lucide--x] size-3.5 shrink-0" />
        </Button>
      </Tooltip>
    </span>
  </div>
</template>
