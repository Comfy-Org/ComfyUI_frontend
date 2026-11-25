<script setup lang="ts">
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { AgentErrorContext } from '@/platform/workflowErrors/agentErrorContext'

import InlineReferenceRemoveButton from './InlineReferenceRemoveButton.vue'
import { inlineReferenceChipClass } from './inlineReferenceChipStyles'

const { context, removeLabel, countLabel } = defineProps<{
  context: AgentErrorContext
  removeLabel: string
  countLabel: string
}>()
const emit = defineEmits<{ remove: [] }>()

const isError = computed(() => context.severity === 'error')
const problemList = computed(() =>
  context.problems.map((problem) => problem.message).join('\n')
)
</script>

<template>
  <span
    data-testid="error-reference-chip"
    :class="inlineReferenceChipClass"
    :title="problemList"
  >
    <i
      aria-hidden="true"
      data-testid="error-reference-icon"
      :class="
        cn(
          'size-3',
          isError
            ? 'icon-[lucide--circle-alert]'
            : 'icon-[lucide--triangle-alert]'
        )
      "
    />
    <span class="max-w-56 min-w-0 truncate">{{ context.label }}</span>
    <span
      v-if="context.count > 1"
      data-testid="error-reference-count"
      :aria-label="countLabel"
      class="shrink-0 text-muted-foreground tabular-nums"
    >
      {{ context.count }}
    </span>
    <InlineReferenceRemoveButton
      :label="removeLabel"
      data-testid="error-reference-remove"
      @remove="emit('remove')"
    />
  </span>
</template>
