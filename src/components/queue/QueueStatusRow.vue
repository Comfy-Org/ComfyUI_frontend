<template>
  <div
    class="job-toast-row group flex h-12 w-full items-center gap-3 rounded-lg pr-1.5 pl-3 transition-colors focus-within:bg-secondary hover:bg-secondary"
    :style="{ '--row-delay': `${delayMs}ms` }"
    :data-status="job.status"
    data-testid="queue-status-row"
  >
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

    <div class="relative flex min-w-0 flex-1 flex-col">
      <span class="truncate text-[13px]/4 text-foreground">
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
      <span
        v-if="job.status === 'running'"
        class="pointer-events-none absolute inset-x-0 top-full mt-1 h-0.5 overflow-hidden rounded-full bg-foreground/10"
        aria-hidden
      >
        <span
          class="block h-full rounded-full bg-foreground/60 transition-[width] duration-200 ease-out"
          :style="{ width: `${job.progress}%` }"
          data-testid="queue-status-row-progress"
        />
      </span>
    </div>

    <Button
      v-if="job.status === 'failed'"
      variant="muted-textonly"
      size="sm"
      class="h-7 shrink-0 hover:bg-background"
      data-testid="queue-status-row-details"
      @click="emit('details')"
    >
      {{ t('queueStatus.details') }}
    </Button>
    <TextTooltip v-else :text="t('queueStatus.cancelRunTooltip')" side="left">
      <Button
        variant="muted-textonly"
        size="unset"
        class="size-7 shrink-0 rounded-md opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 hover:bg-background hover:text-foreground focus-visible:opacity-100 pointer-coarse:opacity-100"
        :aria-label="`${t('queueStatus.cancel')} ${job.title}`"
        data-testid="queue-status-row-cancel"
        @click="emit('cancel')"
      >
        <span class="size-2.5 rounded-[2px] bg-current" aria-hidden />
      </Button>
    </TextTooltip>
  </div>
</template>

<script setup lang="ts">
import Button from '@comfyorg/design-system/button/Button'
import TextTooltip from '@comfyorg/design-system/tooltip/TextTooltip'
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
