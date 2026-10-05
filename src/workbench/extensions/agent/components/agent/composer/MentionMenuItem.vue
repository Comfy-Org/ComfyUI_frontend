<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@comfyorg/tailwind-utils'
import AccessibleTooltip from '@/components/ui/tooltip/AccessibleTooltip.vue'
import type { useAgentMentionPicker } from '../../../composables/agent/useAgentMentionPicker'
import AssetThumbnail from './AssetThumbnail.vue'

type MentionMatch = ReturnType<
  typeof useAgentMentionPicker
>['mentionMatches']['value'][number]
const {
  match,
  index,
  active,
  disabled,
  nodeReferenceDisabledReason,
  duplicateNodeTitles
} = defineProps<{
  match: MentionMatch
  index: number
  active: boolean
  disabled: boolean
  nodeReferenceDisabledReason?: string
  duplicateNodeTitles: Set<string>
}>()
const emit = defineEmits<{ highlight: []; pick: [] }>()
const disabledReason = computed(() =>
  match.kind === 'node' || (match.kind === 'section' && match.id === 'nodes')
    ? nodeReferenceDisabledReason
    : undefined
)
const asset = computed(() => (match.kind === 'asset' ? match.asset : undefined))
const icon = computed(() => {
  if (match.kind === 'back') return 'icon-[lucide--chevron-left] size-4'
  if (match.kind !== 'section') return undefined
  return match.id === 'nodes'
    ? 'icon-[comfy--node] size-3.5'
    : 'icon-[comfy--workflow] size-3.5'
})
const unsavedWorkflow = computed(
  () => match.kind === 'workflow' && match.workflow.id === undefined
)
const nodeId = computed(() =>
  match.kind === 'node' && duplicateNodeTitles.has(match.node.title)
    ? match.node.id
    : undefined
)
</script>

<template>
  <AccessibleTooltip
    :label="disabledReason ?? ''"
    :disabled="!disabledReason"
    :skip-delay-duration="0"
    disable-hoverable-content
    :collision-padding="8"
  >
    <template #trigger>
      <div
        :id="`agent-reference-item-${index}`"
        :aria-disabled="disabled || undefined"
        :aria-description="disabledReason"
        role="menuitem"
        :aria-label="asset ? match.label : undefined"
        :data-active="active"
        :class="
          cn(
            'flex h-7 w-full cursor-pointer items-center gap-1.5 rounded-lg px-1.5 py-1 text-xs font-normal text-base-foreground outline-none aria-disabled:cursor-not-allowed aria-disabled:opacity-50',
            active && 'bg-secondary-background-hover'
          )
        "
        @mouseenter="emit('highlight')"
        @click="emit('pick')"
      >
        <span v-if="icon" :class="cn(icon, 'shrink-0')" />
        <AssetThumbnail
          v-if="asset"
          :name="asset.name"
          :preview-url="asset.previewUrl"
          variant="menu"
          class="size-5 shrink-0"
        />
        <span class="min-w-0 flex-1 truncate">{{ match.label }}</span>
        <span v-if="unsavedWorkflow" class="text-xs text-muted-foreground">{{
          $t('agent.unsavedWorkflow')
        }}</span>
        <span
          v-if="nodeId !== undefined"
          class="ml-auto shrink-0 rounded-full bg-interface-menu-keybind-surface-default px-1 py-0.5 font-mono text-xs/4 text-base-foreground"
        >
          {{ ' #' + nodeId }}</span
        >
        <span
          v-if="match.kind === 'section'"
          class="icon-[lucide--chevron-right] size-4 shrink-0"
        />
      </div>
    </template>
  </AccessibleTooltip>
</template>
