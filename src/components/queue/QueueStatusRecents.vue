<template>
  <div class="flex w-full flex-col">
    <span
      class="flex h-8 items-center px-3 text-[11px] font-medium tracking-wider text-muted-foreground uppercase"
    >
      {{ t('queueStatus.recentResults') }}
    </span>

    <div v-if="results.length" class="flex flex-col gap-0.5">
      <div
        v-for="result in results"
        :key="result.id"
        class="group relative flex h-12 items-center gap-3 rounded-lg pr-1.5 pl-3 transition-colors focus-within:bg-secondary hover:bg-secondary"
        data-testid="queue-status-recent-job"
      >
        <button
          type="button"
          class="absolute inset-0 rounded-lg outline-none focus-visible:ring-1 focus-visible:ring-ring"
          :aria-label="t('queueStatus.viewResult', { name: result.name })"
          @click="emit('view', result.job)"
        />
        <span
          class="pointer-events-none relative flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-secondary group-hover:bg-background"
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
            class="icon-[lucide--file-text] size-3.5 text-muted-foreground"
            aria-hidden
          />
          <i
            v-if="result.isVideo"
            class="absolute right-0.5 bottom-0.5 icon-[lucide--play] size-2.5 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]"
            aria-hidden
          />
        </span>
        <span class="pointer-events-none flex min-w-0 flex-1 flex-col">
          <span class="truncate text-[13px]/4 text-foreground">
            {{ result.name }}
          </span>
          <span class="truncate text-xs/4 text-muted-foreground">
            {{ result.meta }}
          </span>
        </span>
        <TextTooltip :text="t('queueStatus.openWorkflowTooltip')" side="left">
          <Button
            variant="muted-textonly"
            size="unset"
            class="relative size-7 shrink-0 rounded-md opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 hover:bg-background hover:text-foreground pointer-coarse:opacity-100"
            :aria-label="t('queueStatus.openWorkflow', { name: result.name })"
            data-testid="queue-status-recent-workflow"
            @click="emit('openWorkflow', result.job)"
          >
            <i class="icon-[lucide--workflow] size-3.5" aria-hidden />
          </Button>
        </TextTooltip>
      </div>
    </div>
    <p
      v-else
      class="flex h-12 items-center px-3 text-[13px] text-muted-foreground"
    >
      {{ t('queueStatus.nothingRunning') }}
    </p>

    <div class="mt-1 flex h-9 items-center px-1">
      <Button
        variant="muted-textonly"
        size="sm"
        class="h-7 gap-1.5 hover:text-foreground"
        data-testid="queue-status-go-history"
        @click="emit('history')"
      >
        <i class="icon-[lucide--history] size-3.5" aria-hidden />
        {{ t('queueStatus.goToHistoryShort') }}
      </Button>
    </div>
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
