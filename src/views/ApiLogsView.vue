<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import Button from '@/components/ui/button/Button.vue'
import { cn } from '@comfyorg/tailwind-utils'

type LogStatus = 'succeeded' | 'failed' | 'running' | 'queued'

interface ApiLogEntry {
  id: string
  workflow: string
  source: 'api' | 'playground'
  status: LogStatus
  queued?: string
  running?: string
  duration?: string
  cost?: string
  created: string
  error?: string
}

// Design-mock data standing in for the platform jobs backend.
const LOG_ENTRIES: ApiLogEntry[] = [
  {
    id: 'job_01j9x4r2mk',
    workflow: 'api-test',
    source: 'api',
    status: 'queued',
    created: 'Jul 3, 09:14'
  },
  {
    id: 'job_01j9x2m8kq',
    workflow: 'api-test',
    source: 'api',
    status: 'running',
    queued: '42ms',
    running: '12.1s',
    created: 'Jul 3, 09:12'
  },
  {
    id: 'job_01j9x1t3vp',
    workflow: 'api-test',
    source: 'playground',
    status: 'succeeded',
    queued: '31ms',
    running: '8.0s',
    duration: '8.0s',
    cost: '$0.04',
    created: 'Jul 3, 08:58'
  },
  {
    id: 'job_01j9wzr7dn',
    workflow: 'portrait-maker',
    source: 'api',
    status: 'failed',
    queued: '2.3s',
    running: '35.6s',
    duration: '37.9s',
    created: 'Jul 2, 04:35',
    error: 'Missing model: sdxl_vae.safetensors'
  },
  {
    id: 'job_01j9wyn1sc',
    workflow: 'portrait-maker',
    source: 'api',
    status: 'succeeded',
    queued: '45ms',
    running: '1m 50.9s',
    duration: '1m 50.9s',
    cost: '$0.21',
    created: 'Jul 2, 04:32'
  },
  {
    id: 'job_01j9wx8f4t',
    workflow: 'video-upscaler',
    source: 'api',
    status: 'failed',
    duration: '32s',
    created: 'Jul 1, 13:51',
    error: 'Input validation: "image" must be an HTTPS URL or data URI'
  },
  {
    id: 'job_01j9wvq9hz',
    workflow: 'video-upscaler',
    source: 'api',
    status: 'succeeded',
    queued: '55ms',
    running: '2m 1.1s',
    duration: '2m 1.2s',
    cost: '$0.32',
    created: 'Jul 1, 13:46'
  },
  {
    id: 'job_01j9wtd2xw',
    workflow: 'api-test',
    source: 'playground',
    status: 'succeeded',
    queued: '28ms',
    running: '6.9s',
    duration: '7s',
    cost: '$0.04',
    created: 'Jul 1, 13:40'
  }
]

const STATUS_CLASSES: Record<LogStatus, string> = {
  succeeded: 'bg-success-background/20 text-success-background',
  failed: 'bg-destructive-background/20 text-destructive-background',
  running: 'bg-primary-background/20 text-primary-background',
  queued: 'bg-secondary-background text-muted-foreground'
}

const { t } = useI18n()
const router = useRouter()

const columns = computed(() => [
  t('apiLogs.columns.id'),
  t('apiLogs.columns.workflow'),
  t('apiLogs.columns.source'),
  t('apiLogs.columns.status'),
  t('apiLogs.columns.queued'),
  t('apiLogs.columns.running'),
  t('apiLogs.columns.duration'),
  t('apiLogs.columns.cost'),
  t('apiLogs.columns.created')
])
</script>

<template>
  <div class="bg-comfy-menu-secondary-bg size-full overflow-y-auto">
    <div class="mx-auto flex max-w-6xl flex-col gap-6 p-6">
      <header class="flex items-center gap-3">
        <Button
          variant="secondary"
          size="icon-lg"
          :aria-label="t('g.back')"
          @click="router.back()"
        >
          <i class="icon-[lucide--arrow-left]" />
        </Button>
        <div>
          <h1 class="m-0 text-2xl font-bold text-base-foreground">
            {{ t('apiLogs.title') }}
          </h1>
          <p class="mt-1 mb-0 text-sm text-muted-foreground">
            {{ t('apiLogs.subtitle') }}
          </p>
        </div>
      </header>
      <section
        class="overflow-x-auto rounded-2xl border border-border-subtle bg-base-background"
      >
        <table class="w-full border-collapse text-sm">
          <thead>
            <tr
              class="border-b border-border-subtle text-left text-xs text-muted-foreground"
            >
              <th class="w-8 p-3" />
              <th
                v-for="column in columns"
                :key="column"
                class="p-3 font-medium whitespace-nowrap"
              >
                {{ column }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="entry in LOG_ENTRIES"
              :key="entry.id"
              class="border-b border-border-subtle last:border-b-0"
            >
              <td class="p-3">
                <i
                  v-if="entry.error"
                  class="icon-[lucide--triangle-alert] size-4 text-destructive-background"
                  :title="entry.error"
                />
              </td>
              <td class="p-3 font-mono text-xs whitespace-nowrap">
                {{ entry.id }}
              </td>
              <td class="p-3 font-mono text-xs whitespace-nowrap">
                {{ entry.workflow }}
              </td>
              <td class="p-3 whitespace-nowrap">
                {{ t(`apiLogs.sources.${entry.source}`) }}
              </td>
              <td class="p-3 whitespace-nowrap">
                <span
                  :class="
                    cn(
                      'rounded-md px-1.5 py-0.5 text-xs',
                      STATUS_CLASSES[entry.status]
                    )
                  "
                >
                  {{ t(`apiLogs.statuses.${entry.status}`) }}
                </span>
              </td>
              <td class="p-3 whitespace-nowrap tabular-nums">
                {{ entry.queued ?? '—' }}
              </td>
              <td class="p-3 whitespace-nowrap tabular-nums">
                {{ entry.running ?? '—' }}
              </td>
              <td class="p-3 whitespace-nowrap tabular-nums">
                {{ entry.duration ?? '—' }}
              </td>
              <td class="p-3 whitespace-nowrap tabular-nums">
                {{ entry.cost ?? '—' }}
              </td>
              <td
                class="p-3 whitespace-nowrap text-muted-foreground tabular-nums"
              >
                {{ entry.created }}
              </td>
            </tr>
          </tbody>
        </table>
      </section>
      <div>
        <Button variant="secondary" size="md">
          {{ t('apiLogs.viewMore') }}
        </Button>
      </div>
    </div>
  </div>
</template>
