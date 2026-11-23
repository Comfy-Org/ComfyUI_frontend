<template>
  <div
    :class="
      cn(
        'job-toast-row group relative flex h-12 w-full shrink-0 items-center gap-3 overflow-hidden rounded-lg bg-secondary/60 pr-1.5 pl-3 transition-colors focus-within:bg-secondary hover:bg-secondary'
      )
    "
    :style="{ '--row-delay': `${delayMs}ms` }"
    :data-status="job.status"
    data-testid="queue-status-row"
  >
    <span class="flex size-4 shrink-0 items-center justify-center">
      <i
        v-if="isRunning"
        class="icon-[lucide--circle] size-3.5 text-muted-foreground"
        data-testid="queue-status-row-running-icon"
        aria-hidden
      />
      <i
        v-else-if="job.status === 'held'"
        class="icon-[lucide--hourglass] size-3.5 text-muted-foreground"
        aria-hidden
      />
      <i
        v-else-if="isFailed"
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
      <span class="truncate text-[13px]/4 text-foreground">
        {{ job.title }}
      </span>
      <span
        :class="
          cn(
            'truncate text-xs/4',
            isFailed ? 'text-destructive' : 'text-muted-foreground'
          )
        "
      >
        {{ subtitle }}
      </span>
    </div>

    <Button
      v-if="isFailed"
      variant="muted-textonly"
      size="sm"
      class="h-7 shrink-0 hover:bg-background"
      data-testid="queue-status-row-details"
      @click="emit('details')"
    >
      {{ t('queueStatus.details') }}
    </Button>
    <TextTooltip v-else :text="actionTooltip" side="left">
      <Button
        variant="muted-textonly"
        size="unset"
        class="size-7 shrink-0 rounded-md opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 hover:bg-background hover:text-foreground focus-visible:opacity-100 pointer-coarse:opacity-100"
        :aria-label="actionLabel"
        :data-action="isRunning ? 'stop' : 'remove'"
        data-testid="queue-status-row-cancel"
        @click="emit('cancel')"
      >
        <span
          v-if="isRunning"
          class="size-2.5 rounded-[2px] bg-current"
          aria-hidden
        />
        <i v-else class="icon-[lucide--x]" aria-hidden />
      </Button>
    </TextTooltip>

    <span
      v-if="isRunning"
      class="pointer-events-none absolute bottom-0 left-0 h-0.5 bg-foreground/70 transition-[width] duration-200 ease-out"
      :style="{ width: `${job.progress}%` }"
      data-testid="queue-status-row-progress"
      aria-hidden
    />
  </div>
</template>

<script setup lang="ts">
import Button from '@comfyorg/design-system/button/Button'
import TextTooltip from '@comfyorg/design-system/tooltip/TextTooltip'
import { cn } from '@comfyorg/tailwind-utils'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { JobView } from './queueStatusTypes'

const { job } = defineProps<{
  job: JobView
  subtitle: string
  delayMs: number
}>()

const emit = defineEmits<{ cancel: []; details: [] }>()

const { t } = useI18n()

const isRunning = computed(() => job.status === 'running')
const isFailed = computed(() => job.status === 'failed')
const actionTooltip = computed(() =>
  isRunning.value
    ? t('queueStatus.cancelRunTooltip')
    : t('queueStatus.removeFromQueueTooltip')
)
const actionLabel = computed(() =>
  isRunning.value
    ? `${t('queueStatus.cancel')} ${job.title}`
    : t('queueStatus.removeFromQueue', { title: job.title })
)
</script>
