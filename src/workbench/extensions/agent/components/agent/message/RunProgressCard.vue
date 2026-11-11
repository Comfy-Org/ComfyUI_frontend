<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'

const { view, durationMs } = defineProps<{
  view: 'starting' | 'running' | 'notStarted' | 'ran' | 'requested'
  durationMs?: number
}>()

const { t } = useI18n()

const live = computed(() => view === 'starting' || view === 'running')

const duration = computed(() => {
  const totalSeconds = Math.round((durationMs ?? 0) / 1000)
  if (totalSeconds < 1) return undefined
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return minutes > 0
    ? t('agent.run.minutes', { minutes, seconds })
    : t('agent.run.seconds', { seconds })
})

const text = computed(() => {
  if (view === 'starting') return t('agent.run.submitted')
  if (view === 'running') return t('agent.run.running')
  if (view === 'notStarted') return t('agent.run.notStarted')
  if (view === 'requested') return t('agent.run.requested')
  return duration.value
    ? t('agent.run.ranIn', { duration: duration.value })
    : t('agent.run.ran')
})
</script>

<template>
  <div
    role="group"
    :aria-label="t('agent.run.label')"
    :class="
      cn(
        'text-sm/5 text-muted-foreground',
        live
          ? 'flex flex-col gap-2 rounded-lg border border-border px-3 py-2.5'
          : 'flex items-start gap-2 px-2 py-1.5'
      )
    "
  >
    <template v-if="live">
      <div class="flex items-center gap-2">
        <i
          aria-hidden="true"
          class="icon-[lucide--loader-circle] motion-safe:animate-spin"
        />
        <span class="agent-shimmer-text min-w-0 truncate">{{ text }}</span>
      </div>
      <div
        role="progressbar"
        :aria-label="text"
        class="relative h-1 overflow-hidden rounded-full bg-border"
      >
        <div
          class="agent-run-bar absolute inset-y-0 left-0 w-1/3 rounded-full bg-primary"
        />
      </div>
      <p v-if="view === 'running'" class="m-0 text-xs">
        {{ t('agent.run.noDetail') }}
      </p>
    </template>
    <template v-else>
      <i
        aria-hidden="true"
        :class="
          cn(
            'mt-0.5',
            view === 'notStarted'
              ? 'icon-[lucide--circle-x]'
              : 'icon-[lucide--play]'
          )
        "
      />
      <span class="min-w-0">{{ text }}</span>
    </template>
  </div>
</template>
