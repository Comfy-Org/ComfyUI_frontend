<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import HoneyToast from '@/components/honeyToast/HoneyToast.vue'
import Button from '@/components/ui/button/Button.vue'
import type { AssetExport } from '@/stores/assetExportStore'
import { useAssetExportStore } from '@/stores/assetExportStore'
import { cn } from '@/utils/tailwindUtil'

const { t } = useI18n()
const assetExportStore = useAssetExportStore()

const visible = computed(() => assetExportStore.hasExports)
const isExpanded = ref(false)

const exportJobs = computed(() => assetExportStore.exportList)
const failedJobs = computed(() =>
  assetExportStore.finishedExports.filter((e) => e.status === 'failed')
)

const isInProgress = computed(() => assetExportStore.hasActiveExports)
const currentJobName = computed(() => {
  const activeJob = exportJobs.value.find((job) => job.status === 'running')
  return activeJob?.exportName || t('exportToast.preparingExport')
})

const completedCount = computed(() => assetExportStore.finishedExports.length)
const totalCount = computed(() => exportJobs.value.length)

function progressPercent(job: AssetExport): number {
  return Math.round(job.progress * 100)
}

function closeDialog() {
  assetExportStore.clearFinishedExports()
  isExpanded.value = false
}
</script>

<template>
  <HoneyToast v-model:expanded="isExpanded" :visible>
    <template #default>
      <div
        class="flex h-12 items-center justify-between border-b border-border-default px-4"
      >
        <h3 class="text-sm font-bold text-base-foreground">
          {{ t('exportToast.exportingAssets') }}
        </h3>
      </div>

      <div class="relative max-h-75 overflow-y-auto px-4 py-4">
        <div class="flex flex-col gap-2">
          <div
            v-for="job in exportJobs"
            :key="job.taskId"
            :class="
              cn(
                'flex items-center justify-between rounded-lg bg-modal-card-background px-4 py-3',
                job.status === 'completed' && 'opacity-50'
              )
            "
          >
            <div class="min-w-0 flex-1">
              <span class="block truncate text-sm text-base-foreground">
                {{ job.exportName || t('exportToast.preparingExport') }}
              </span>
              <span
                v-if="job.assetsTotal > 0"
                class="text-xs text-muted-foreground"
              >
                {{ job.assetsAttempted }}/{{ job.assetsTotal }}
                {{ t('progressToast.filter.all').toLowerCase() }}
              </span>
            </div>

            <div class="flex flex-shrink-0 items-center gap-2">
              <template v-if="job.status === 'failed'">
                <i
                  class="icon-[lucide--circle-alert] size-4 text-destructive-background"
                />
              </template>
              <template v-else-if="job.status === 'completed'">
                <Button
                  variant="muted-textonly"
                  size="icon"
                  :aria-label="t('exportToast.downloadExport')"
                  @click.stop="assetExportStore.triggerDownload(job, true)"
                >
                  <i
                    class="icon-[lucide--download] size-4 text-success-background"
                  />
                </Button>
              </template>
              <template v-else-if="job.status === 'running'">
                <i
                  class="icon-[lucide--loader-circle] size-4 animate-spin text-base-foreground"
                />
                <span class="text-xs text-base-foreground">
                  {{ progressPercent(job) }}%
                </span>
              </template>
              <template v-else>
                <span class="text-xs text-muted-foreground">
                  {{ t('progressToast.pending') }}
                </span>
              </template>
            </div>
          </div>
        </div>

        <div
          v-if="exportJobs.length === 0"
          class="flex flex-col items-center justify-center py-6 text-center"
        >
          <span class="text-sm text-muted-foreground">
            {{
              t('exportToast.noExportsInQueue', {
                filter: t('progressToast.filter.all')
              })
            }}
          </span>
        </div>
      </div>
    </template>

    <template #footer="{ toggle }">
      <div
        class="flex h-12 items-center justify-between gap-2 border-t border-border-default px-4"
      >
        <div class="flex min-w-0 flex-1 items-center gap-2 text-sm">
          <template v-if="isInProgress">
            <i
              class="icon-[lucide--loader-circle] size-4 flex-shrink-0 animate-spin text-muted-foreground"
            />
            <span
              class="min-w-0 flex-1 truncate font-bold text-base-foreground"
            >
              {{ currentJobName }}
            </span>
          </template>
          <template v-else-if="failedJobs.length > 0">
            <i
              class="icon-[lucide--circle-alert] size-4 flex-shrink-0 text-destructive-background"
            />
            <span class="min-w-0 truncate font-bold text-base-foreground">
              {{ t('exportToast.exportFailed', { count: failedJobs.length }) }}
            </span>
          </template>
          <template v-else>
            <i
              class="icon-[lucide--check-circle] size-4 flex-shrink-0 text-jade-600"
            />
            <span class="min-w-0 truncate font-bold text-base-foreground">
              {{ t('exportToast.allExportsCompleted') }}
            </span>
          </template>
        </div>

        <div class="flex flex-shrink-0 items-center gap-2">
          <span
            v-if="isInProgress"
            class="whitespace-nowrap text-sm text-muted-foreground"
          >
            {{
              t('progressToast.progressCount', {
                completed: completedCount,
                total: totalCount
              })
            }}
          </span>

          <div class="flex items-center">
            <Button
              variant="muted-textonly"
              size="icon"
              :aria-label="
                isExpanded ? t('contextMenu.Collapse') : t('contextMenu.Expand')
              "
              @click.stop="toggle"
            >
              <i
                :class="
                  cn(
                    'size-4',
                    isExpanded
                      ? 'icon-[lucide--chevron-down]'
                      : 'icon-[lucide--chevron-up]'
                  )
                "
              />
            </Button>

            <Button
              v-if="!isInProgress"
              variant="muted-textonly"
              size="icon"
              :aria-label="t('g.close')"
              @click.stop="closeDialog"
            >
              <i class="icon-[lucide--x] size-4" />
            </Button>
          </div>
        </div>
      </div>
    </template>
  </HoneyToast>
</template>
