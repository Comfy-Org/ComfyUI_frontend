<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <button
        type="button"
        data-testid="queue-status-idle"
        :aria-label="t('queueStatus.nothingRunning')"
        :aria-expanded="open"
        class="group pointer-events-auto flex cursor-pointer items-center gap-1 rounded-lg border border-solid border-base-foreground/9 bg-transparent px-2 py-1 text-sm/5 text-base-foreground transition-colors hover:bg-secondary-background data-[state=open]:bg-secondary-background"
      >
        {{ label }}
        <i
          class="icon-[lucide--chevron-down] size-3.5 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180"
          aria-hidden
        />
      </button>
    </PopoverTrigger>
    <PopoverContent
      align="end"
      side="bottom"
      :side-offset="8"
      data-testid="queue-status-idle-panel"
      class="flex w-80 flex-col gap-2 rounded-[10px] border border-base-foreground/9 bg-base-background/80 p-2 shadow-[0_4px_18px_rgba(0,0,0,0.3)] backdrop-blur-xl"
    >
      <div class="flex w-full flex-col gap-1">
        <div class="flex items-center justify-between px-1.5 pt-0.5 pb-1">
          <span
            class="text-[11px] font-medium tracking-wide text-muted-foreground uppercase"
          >
            {{ t('queueStatus.recentResults') }}
          </span>
          <button
            type="button"
            class="flex size-3.5 cursor-pointer items-center justify-center border-none bg-transparent p-0 text-muted-foreground transition-colors hover:text-base-foreground"
            :aria-label="t('queueStatus.goToHistoryShort')"
            data-testid="queue-status-filter"
            @click="emit('history')"
          >
            <i class="icon-[lucide--list-filter] size-3.5" aria-hidden />
          </button>
        </div>

        <template v-if="results.length">
          <button
            v-for="result in results"
            :key="result.id"
            type="button"
            class="relative flex cursor-pointer items-center gap-2.5 overflow-hidden rounded-[8px] border-none bg-transparent px-1.5 py-2 text-left transition-colors hover:bg-secondary-background"
            :aria-label="t('queueStatus.viewResult')"
            data-testid="queue-status-recent-job"
            @click="emit('view', result.job)"
          >
            <span
              v-if="result.thumbSrc"
              class="relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-[6px] bg-base-background outline-1 outline-white/10"
            >
              <img
                :src="result.thumbSrc"
                alt=""
                loading="lazy"
                class="size-full object-cover"
              />
              <i
                v-if="result.isVideo"
                class="absolute right-0.5 bottom-0.5 icon-[lucide--play] size-2.5 text-base-foreground drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]"
                aria-hidden
              />
            </span>
            <span class="flex min-w-0 flex-1 flex-col gap-0.5">
              <span
                class="truncate text-[13px] leading-none text-base-foreground"
              >
                {{ result.name }}
              </span>
              <span
                class="truncate text-[11px] leading-none text-muted-foreground"
              >
                {{ result.meta }}
              </span>
            </span>
          </button>
        </template>
        <p
          v-else
          class="px-1.5 py-3 text-center text-[11.5px] text-muted-foreground"
        >
          {{ t('queueStatus.nothingRunning') }}
        </p>
      </div>

      <div
        class="flex w-full items-center justify-end border-t border-base-foreground/6 pt-1.5"
      >
        <button
          type="button"
          class="flex cursor-pointer items-center gap-1.5 rounded-[7px] border-none bg-transparent px-2 py-1.5 text-[11.5px] font-medium text-muted-foreground transition-colors hover:bg-base-foreground/6 hover:text-base-foreground"
          data-testid="queue-status-go-history"
          @click="emit('history')"
        >
          <i class="icon-[lucide--history] size-3" aria-hidden />
          {{ t('queueStatus.goToHistoryShort') }}
        </button>
      </div>
    </PopoverContent>
  </Popover>
</template>

<script setup lang="ts">
import { PopoverTrigger } from 'reka-ui'
import { useI18n } from 'vue-i18n'

import Popover from '@/components/ui/popover/Popover.vue'
import PopoverContent from '@/components/ui/popover/PopoverContent.vue'
import type { JobListItem } from '@/composables/queue/useJobList'

import type { RecentResult } from './queueStatusTypes'

defineProps<{
  label: string
  results: RecentResult[]
}>()

const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  view: [job: JobListItem]
  history: []
}>()

const { t } = useI18n()
</script>
