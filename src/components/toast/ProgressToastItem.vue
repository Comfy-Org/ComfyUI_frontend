<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Loader from '@/components/loader/Loader.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import Button from '@/components/ui/button/Button.vue'
import type { TaskId } from '@/platform/tasks/services/taskService'
import type { AssetDownload } from '@/stores/assetDownloadStore'
import { isDownloadCancelled } from '@/stores/assetDownloadStore'
import { cn } from '@comfyorg/tailwind-utils'

const { job, isCancelling = false } = defineProps<{
  job: AssetDownload
  isCancelling?: boolean
}>()
const emit = defineEmits<{ cancel: [taskId: TaskId] }>()

const { t } = useI18n()

const progressPercent = computed(() => Math.round(job.progress * 100))
const isCompleted = computed(() => job.status === 'completed')
const isFailed = computed(() => job.status === 'failed')
const isRunning = computed(() => job.status === 'running')
const isPending = computed(() => job.status === 'created')
const isCancelled = computed(() => isDownloadCancelled(job.status))
</script>

<template>
  <div
    class="flex items-center justify-between rounded-lg bg-modal-card-background px-4 py-3"
  >
    <div :class="cn('min-w-0 flex-1', isCompleted && 'opacity-50')">
      <span class="block truncate text-sm text-base-foreground">{{
        job.assetName
      }}</span>
    </div>

    <div class="flex shrink-0 items-center gap-2">
      <template v-if="isFailed">
        <i
          class="icon-[lucide--circle-alert] size-4 text-destructive-background"
        />
        <StatusBadge :label="t('progressToast.failed')" severity="danger" />
      </template>

      <template v-else-if="isCompleted">
        <StatusBadge :label="t('progressToast.finished')" severity="contrast" />
      </template>

      <template v-else-if="isCancelled">
        <StatusBadge
          :label="t('electronFileDownload.cancelled')"
          severity="secondary"
        />
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

      <Button
        v-if="isRunning || isPending"
        variant="muted-textonly"
        size="sm"
        :disabled="isCancelling"
        @click="emit('cancel', job.taskId)"
      >
        {{ t('g.cancel') }}
      </Button>
    </div>
  </div>
</template>
