<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Loader from '@/components/loader/Loader.vue'
import Badge from '@/components/common/Badge.vue'
import type { AssetDownload } from '@/stores/assetDownloadStore'
import { cn } from '@/utils/tailwindUtil'

const { job } = defineProps<{
  job: AssetDownload
}>()

const { t } = useI18n()

const progressPercent = computed(() => Math.round(job.progress * 100))
const isCompleted = computed(() => job.status === 'completed')
const isFailed = computed(() => job.status === 'failed')
const isRunning = computed(() => job.status === 'running')
const isPending = computed(() => job.status === 'created')
</script>

<template>
  <div
    :class="
      cn(
        'flex items-center justify-between rounded-lg bg-modal-card-background px-4 py-3',
        isCompleted && 'opacity-50'
      )
    "
  >
    <div class="min-w-0 flex-1">
      <span class="block truncate text-sm text-base-foreground">{{
        job.assetName
      }}</span>
    </div>

    <div class="flex shrink-0 items-center gap-2">
      <template v-if="isFailed">
        <i
          class="icon-[lucide--circle-alert] size-4 text-destructive-background"
        />
        <Badge :label="t('progressToast.failed')" severity="danger" />
      </template>

      <template v-else-if="isCompleted">
        <Badge :label="t('progressToast.finished')" severity="contrast" />
      </template>

      <template v-else-if="isRunning">
        <Loader size="sm" class="text-base-foreground" />
        <span class="text-xs text-base-foreground">
          {{ progressPercent }}%
        </span>
      </template>

      <template v-else-if="isPending">
        <span class="text-xs text-muted-foreground">
          {{ t('progressToast.pending') }}
        </span>
      </template>
    </div>
  </div>
</template>
