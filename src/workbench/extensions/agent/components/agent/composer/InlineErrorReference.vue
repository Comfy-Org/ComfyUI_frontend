<script setup lang="ts">
import { computed } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import { cn } from '@comfyorg/tailwind-utils'

import type { AgentErrorContext } from '../../../types/agentErrorContext'

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
</script>

<template>
  <span
    data-testid="error-reference-chip"
    tabindex="0"
    :class="inlineReferenceChipClass"
  >
    <i
      aria-hidden="true"
      data-testid="error-reference-icon"
      :class="
        cn(
          'size-3 shrink-0',
          isError
            ? 'icon-[comfy--circle-alert-filled] text-destructive-background-hover'
            : 'icon-[comfy--triangle-alert-filled] text-warning-foreground'
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
          <span aria-hidden="true" class="icon-[lucide--x] size-2" />
        </span>
      </Button>
    </span>
  </span>
</template>
