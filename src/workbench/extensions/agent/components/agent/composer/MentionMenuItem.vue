<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { useI18n } from 'vue-i18n'

import Tooltip from '@/components/ui/tooltip/Tooltip.vue'

import type { MentionMatch } from './mentionMenuTypes'

const {
  match,
  index,
  active,
  nodeReferenceDisabledReason,
  graphDupes,
  duplicateIdClass
} = defineProps<{
  match: MentionMatch
  index: number
  active: boolean
  nodeReferenceDisabledReason?: string
  graphDupes: Set<string>
  duplicateIdClass: string
  isNodeReferenceDisabled: (match: MentionMatch) => boolean
  isMentionDisabled: (match: MentionMatch) => boolean
}>()
const emit = defineEmits<{ highlight: []; pick: [] }>()
const { t } = useI18n()
</script>

<template>
  <Tooltip
    :config="nodeReferenceDisabledReason ?? ''"
    :disabled="!isNodeReferenceDisabled(match)"
    side="top"
    :delay-duration="300"
    :ignore-non-keyboard-focus="false"
    disable-closing-trigger
    :collision-padding="8"
  >
    <div
      :id="`agent-reference-item-${index}`"
      :aria-disabled="isMentionDisabled(match) || undefined"
      :aria-description="
        isNodeReferenceDisabled(match) ? nodeReferenceDisabledReason : undefined
      "
      role="menuitem"
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
      <span
        v-if="match.kind === 'section' && match.id === 'nodes'"
        class="icon-[comfy--node] size-3.5 shrink-0"
      />
      <span
        v-else-if="match.kind === 'section' && match.id === 'workflows'"
        class="icon-[comfy--workflow] size-3.5 shrink-0"
      />
      <span
        v-else-if="match.kind === 'back'"
        class="icon-[lucide--chevron-left] size-4 shrink-0"
      />
      <span class="min-w-0 flex-1 truncate">{{ match.label }}</span>
      <span
        v-if="match.kind === 'workflow' && match.workflow.id === undefined"
        class="text-xs text-muted-foreground"
        >{{ t('agent.unsavedWorkflow') }}</span
      >
      <span
        v-if="match.kind === 'node' && graphDupes.has(match.node.title)"
        :class="cn(duplicateIdClass, 'ml-auto')"
      >
        #{{ match.node.id }}
      </span>
      <span
        v-if="match.kind === 'section'"
        class="icon-[lucide--chevron-right] size-4 shrink-0"
      />
    </div>
  </Tooltip>
</template>
