<template>
  <div
    :class="
      cn(
        'job-toast-row relative w-full overflow-hidden rounded-lg border border-foreground/9 bg-background py-1 pr-1.5 pl-3 shadow-md transition-colors hover:bg-secondary',
        job.status === 'failed' && 'border-destructive/40'
      )
    "
    :style="{ '--row-delay': `${delayMs}ms` }"
    :data-status="job.status"
    data-testid="queue-status-row"
  >
    <div class="flex items-center gap-2">
      <span class="flex size-4 shrink-0 items-center justify-center">
        <span
          v-if="job.status === 'running'"
          class="inline-block size-[13px] animate-spin rounded-full border-2 border-foreground/20 border-t-foreground/80"
          aria-hidden
        />
        <i
          v-else-if="job.status === 'held'"
          class="icon-[lucide--hourglass] size-3.5 text-muted-foreground"
          aria-hidden
        />
        <i
          v-else-if="job.status === 'failed'"
          class="icon-[lucide--circle-alert] text-destructive"
          aria-hidden
        />
        <span
          v-else
          class="size-1.5 rounded-full bg-muted-foreground"
          aria-hidden
        />
      </span>

      <div class="flex min-w-0 flex-1 flex-col">
        <span class="truncate text-xs/4 text-foreground">
          {{ job.title }}
        </span>
        <span
          :class="
            cn(
              'truncate text-xs/4',
              job.status === 'failed'
                ? 'text-destructive'
                : 'text-muted-foreground'
            )
          "
        >
          {{ subtitle }}
        </span>
      </div>

      <Button
        v-if="job.status === 'failed'"
        variant="muted-textonly"
        size="sm"
        class="h-8 shrink-0"
        data-testid="queue-status-row-details"
        @click="emit('details')"
      >
        {{ t('queueStatus.details') }}
      </Button>
      <Button
        v-else
        variant="muted-textonly"
        size="icon"
        class="shrink-0 rounded-sm"
        :aria-label="`${t('queueStatus.cancel')} ${job.title}`"
        data-testid="queue-status-row-cancel"
        @click="emit('cancel')"
      >
        <span class="size-3 rounded-xs bg-current" aria-hidden />
      </Button>
    </div>

    <div
      v-if="job.status === 'running'"
      class="pointer-events-none absolute bottom-0 left-0 h-0.5 bg-foreground/70 transition-[width] duration-200 ease-out"
      :style="{ width: `${job.progress}%` }"
      data-testid="queue-status-row-progress"
      aria-hidden
    />
  </div>
</template>

<script setup lang="ts">
import Button from '@comfyorg/design-system/button/Button'
import { cn } from '@comfyorg/tailwind-utils'
import { useI18n } from 'vue-i18n'

import type { JobView } from './queueStatusTypes'

defineProps<{
  job: JobView
  subtitle: string
  delayMs: number
}>()

const emit = defineEmits<{ cancel: []; details: [] }>()

const { t } = useI18n()
</script>
