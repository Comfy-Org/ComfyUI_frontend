<script setup lang="ts">
import { computed } from 'vue'

import Button from '@comfyorg/design-system/button/Button'
import { cn } from '@comfyorg/tailwind-utils'

import type { AgentErrorContext } from '@/platform/workflowErrors/agentErrorContext'

import {
  inlineReferenceChipClass,
  inlineReferenceRemoveAnchorClass,
  inlineReferenceRemoveBadgeClass,
  inlineReferenceRemoveButtonClass
} from './inlineReferenceChipStyles'

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
    <span :class="inlineReferenceRemoveAnchorClass">
      <Button
        type="button"
        variant="textonly"
        size="icon-sm"
        :aria-label="removeLabel"
        data-testid="error-reference-remove"
        :class="inlineReferenceRemoveButtonClass"
        @click.stop="emit('remove')"
      >
        <span :class="inlineReferenceRemoveBadgeClass">
          <i aria-hidden="true" class="icon-[lucide--x] size-2" />
        </span>
      </Button>
    </span>
  </span>
</template>
