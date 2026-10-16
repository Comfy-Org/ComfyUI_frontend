<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { cn } from '@comfyorg/tailwind-utils'

import type { AgentErrorContext } from '../../../types/agentErrorContext'

const { context } = defineProps<{ context: AgentErrorContext }>()
const emit = defineEmits<{ remove: [] }>()

const { t } = useI18n()

const isError = computed(() => context.severity === 'error')
</script>

<template>
  <div
    data-testid="composer-error-context"
    role="group"
    :aria-label="t('agent.errorContext.chipGroupLabel')"
    class="flex max-w-full min-w-0 shrink-0 px-3 pt-3"
  >
    <div
      data-testid="composer-error-context-chip"
      :class="
        cn(
          'flex max-w-full min-w-0 items-center gap-1.5 rounded-md border py-1 pr-1 pl-2 text-xs',
          isError
            ? 'border-node-stroke-error/40 bg-destructive-background/10 text-base-foreground'
            : 'border-warning-foreground/40 bg-warning-background/20 text-base-foreground'
        )
      "
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
      <span class="min-w-0 truncate">{{ context.label }}</span>
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
        class="shrink-0 rounded-full bg-base-foreground/10 px-1.5 text-2xs/4 font-semibold tabular-nums"
      >
        {{ context.count }}
      </span>
      <Button
        variant="muted-textonly"
        size="icon-sm"
        type="button"
        class="size-5 shrink-0 rounded-sm"
        :aria-label="t('agent.errorContext.remove')"
        data-testid="composer-error-context-remove"
        @click="emit('remove')"
      >
        <i aria-hidden="true" class="icon-[lucide--x] size-3.5" />
      </Button>
    </div>
  </div>
</template>
