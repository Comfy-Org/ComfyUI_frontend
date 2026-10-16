<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { cn } from '@comfyorg/tailwind-utils'

import type { AgentErrorContext } from '../../../types/agentErrorContext'
import {
  inlineReferenceChipClass,
  inlineReferenceRemoveAnchorClass,
  inlineReferenceRemoveBadgeClass,
  inlineReferenceRemoveButtonClass
} from './inlineReferenceChipStyles'

const { context } = defineProps<{ context: AgentErrorContext | null }>()
const emit = defineEmits<{ remove: [] }>()

const { t } = useI18n()

const isError = computed(() => context?.severity === 'error')
</script>

<template>
  <div
    v-if="context"
    data-testid="composer-error-context"
    role="group"
    :aria-label="t('agent.errorContext.chipGroupLabel')"
    class="flex max-w-full min-w-0 shrink-0 px-3 pt-3"
  >
    <span
      data-testid="composer-error-context-chip"
      tabindex="0"
      :class="cn(inlineReferenceChipClass, 'pr-0 pl-1.5')"
    >
      <i
        aria-hidden="true"
        :class="
          cn(
            'size-3.5 shrink-0',
            isError
              ? 'icon-[lucide--circle-x] text-destructive-background'
              : 'icon-[lucide--triangle-alert] text-warning-foreground'
          )
        "
      />
      <span class="max-w-56 min-w-0 truncate">{{ context.label }}</span>
      <span
        v-if="context.count > 1"
        data-testid="composer-error-context-count"
        :aria-label="
          t(
            'agent.errorContext.problemCount',
            { count: context.count },
            context.count
          )
        "
        class="shrink-0 text-muted-foreground tabular-nums"
      >
        {{ context.count }}
      </span>
      <span :class="inlineReferenceRemoveAnchorClass">
        <Button
          type="button"
          variant="textonly"
          size="icon-sm"
          :aria-label="t('agent.errorContext.remove')"
          data-testid="composer-error-context-remove"
          :class="inlineReferenceRemoveButtonClass"
          @click.stop="emit('remove')"
        >
          <span :class="inlineReferenceRemoveBadgeClass">
            <span aria-hidden="true" class="icon-[lucide--x] size-2" />
          </span>
        </Button>
      </span>
    </span>
  </div>
</template>
