<template>
  <div class="flex w-full flex-col gap-1">
    <span
      class="px-2 pt-1 pb-0.5 text-[11px]/4 font-medium tracking-wider text-muted-foreground uppercase"
    >
      {{ t('queueStatus.recentResults') }}
    </span>

    <template v-if="results.length">
      <div
        v-for="result in results"
        :key="result.id"
        class="group relative flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-accent"
        data-testid="queue-status-recent-job"
      >
        <button
          type="button"
          class="absolute inset-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
          :aria-label="t('queueStatus.viewResult', { name: result.name })"
          @click="emit('view', result.job)"
        />
        <span
          class="pointer-events-none relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-secondary"
        >
          <img
            v-if="result.thumbSrc"
            :src="result.thumbSrc"
            alt=""
            loading="lazy"
            class="size-full object-cover"
            data-testid="queue-status-recent-thumb"
          />
          <i
            v-else
            class="icon-[lucide--file-text] text-muted-foreground"
            aria-hidden
          />
          <i
            v-if="result.isVideo"
            class="absolute right-1 bottom-1 icon-[lucide--play] size-2.5 text-foreground drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]"
            aria-hidden
          />
        </span>
        <span class="pointer-events-none flex min-w-0 flex-1 flex-col gap-0.5">
          <span class="truncate text-[13px]/4 font-medium text-foreground">
            {{ result.name }}
          </span>
          <span class="truncate text-xs/4 text-muted-foreground">
            {{ result.meta }}
          </span>
        </span>
        <TextTooltip :text="t('queueStatus.openWorkflowTooltip')" side="left">
          <Button
            variant="muted-textonly"
            size="icon"
            class="size-7 shrink-0 rounded-md opacity-0 transition-opacity group-hover:opacity-100 group-has-focus-visible:opacity-100 hover:bg-background"
            :aria-label="t('queueStatus.openWorkflow', { name: result.name })"
            data-testid="queue-status-recent-workflow"
            @click="emit('openWorkflow', result.job)"
          >
            <i class="icon-[lucide--workflow] size-3.5" aria-hidden />
          </Button>
        </TextTooltip>
      </div>
    </template>
    <p v-else class="px-2 py-3 text-center text-xs text-muted-foreground">
      {{ t('queueStatus.nothingRunning') }}
    </p>

    <Button
      variant="secondary"
      size="unset"
      class="mt-1 h-9 w-full gap-2 rounded-lg text-[13px] font-medium"
      data-testid="queue-status-go-history"
      @click="emit('history')"
    >
      <i class="icon-[lucide--history] size-3.5" aria-hidden />
      {{ t('queueStatus.goToHistoryShort') }}
    </Button>
  </div>
</template>

<script setup lang="ts">
import Button from '@comfyorg/design-system/button/Button'
import TextTooltip from '@comfyorg/design-system/tooltip/TextTooltip'
import { useI18n } from 'vue-i18n'

import type { JobListItem } from '@/composables/queue/useJobList'

import type { RecentResult } from './queueStatusTypes'

defineProps<{ results: RecentResult[] }>()

const emit = defineEmits<{
  view: [job: JobListItem]
  openWorkflow: [job: JobListItem]
  history: []
}>()

const { t } = useI18n()
</script>
