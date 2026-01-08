<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import ProgressToastItem from '@/components/toast/ProgressToastItem.vue'
import { useAssetDownloadStore } from '@/stores/assetDownloadStore'
import { cn } from '@/utils/tailwindUtil'

const { t } = useI18n()
const assetDownloadStore = useAssetDownloadStore()

const visible = computed(() => assetDownloadStore.hasDownloads)

const isExpanded = ref(false)
const activeFilter = ref<'all' | 'completed' | 'failed'>('all')
const showFilterMenu = ref(false)

function toggle() {
  isExpanded.value = !isExpanded.value
}

const filterOptions = [
  { value: 'all', label: 'all' },
  { value: 'completed', label: 'completed' },
  { value: 'failed', label: 'failed' }
] as const

function setFilter(filter: typeof activeFilter.value) {
  activeFilter.value = filter
  showFilterMenu.value = false
}

const downloadJobs = computed(() => assetDownloadStore.downloadList)
const completedJobs = computed(() =>
  assetDownloadStore.finishedDownloads.filter((d) => d.status === 'completed')
)
const failedJobs = computed(() =>
  assetDownloadStore.finishedDownloads.filter((d) => d.status === 'failed')
)

const isInProgress = computed(() => assetDownloadStore.hasActiveDownloads)
const currentJobName = computed(() => {
  const activeJob = downloadJobs.value.find((job) => job.status === 'running')
  return activeJob?.assetName || t('progressToast.downloadingModel')
})

const completedCount = computed(
  () => completedJobs.value.length + failedJobs.value.length
)
const totalCount = computed(() => downloadJobs.value.length)

const filteredJobs = computed(() => {
  switch (activeFilter.value) {
    case 'completed':
      return completedJobs.value
    case 'failed':
      return failedJobs.value
    default:
      return downloadJobs.value
  }
})

const activeFilterLabel = computed(() => {
  const option = filterOptions.find((f) => f.value === activeFilter.value)
  return option
    ? t(`progressToast.filter.${option.label}`)
    : t('progressToast.filter.all')
})

function closeDialog() {
  assetDownloadStore.clearFinishedDownloads()
  isExpanded.value = false
}

function handleClickOutside(event: MouseEvent) {
  const target = event.target as HTMLElement
  if (!target.closest('.filter-dropdown')) {
    showFilterMenu.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-all duration-300 ease-out"
      enter-from-class="translate-y-full opacity-0"
      enter-to-class="translate-y-0 opacity-100"
      leave-active-class="transition-all duration-200 ease-in"
      leave-from-class="translate-y-0 opacity-100"
      leave-to-class="translate-y-full opacity-0"
    >
      <div
        v-if="visible"
        class="fixed inset-x-0 bottom-6 z-[9999] mx-auto w-[80%] max-w-3xl overflow-hidden rounded-lg border border-border-default bg-base-background shadow-lg"
        @click="handleClickOutside"
      >
        <!-- Header -->
        <div
          class="flex h-12 items-center justify-between border-b border-border-default px-4"
        >
          <h3 class="text-sm font-bold text-base-foreground">
            {{ t('progressToast.importingModels') }}
          </h3>
          <div class="flex items-center gap-2">
            <!-- Filter Dropdown -->
            <div class="filter-dropdown relative" @click.stop>
              <button
                class="flex h-8 items-center gap-1.5 rounded-lg bg-secondary-background px-2 text-xs text-base-foreground hover:bg-secondary-background-hover"
                @click="showFilterMenu = !showFilterMenu"
              >
                <i class="icon-[lucide--list-filter] size-4" />
                <span>{{ activeFilterLabel }}</span>
                <i class="icon-[lucide--chevron-down] size-3" />
              </button>
              <div
                v-if="showFilterMenu"
                class="absolute right-0 top-full z-50 mt-1 min-w-[120px] rounded-md bg-secondary-background py-1 shadow-lg"
              >
                <button
                  v-for="option in filterOptions"
                  :key="option.value"
                  class="w-full px-3 py-1.5 text-left text-sm transition-colors"
                  :class="
                    activeFilter === option.value
                      ? 'bg-secondary-background-selected text-base-foreground'
                      : 'text-muted-foreground hover:bg-secondary-background-hover hover:text-base-foreground'
                  "
                  @click="setFilter(option.value)"
                >
                  {{ t(`progressToast.filter.${option.label}`) }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Expandable content -->
        <div
          :class="
            cn(
              'overflow-hidden transition-all duration-300',
              isExpanded ? 'max-h-[300px]' : 'max-h-0'
            )
          "
        >
          <div class="relative max-h-[300px] overflow-y-auto px-4 py-4">
            <!-- Scrollbar indicator -->
            <div
              v-if="filteredJobs.length > 3"
              class="absolute right-1 top-4 h-12 w-1 rounded-full bg-muted-foreground"
            />

            <div class="flex flex-col gap-2">
              <ProgressToastItem
                v-for="job in filteredJobs"
                :key="job.taskId"
                :job="job"
              />
            </div>

            <!-- Empty State -->
            <div
              v-if="filteredJobs.length === 0"
              class="flex flex-col items-center justify-center py-6 text-center"
            >
              <span class="text-sm text-muted-foreground">
                {{
                  t('progressToast.noImportsInQueue', {
                    filter: activeFilterLabel
                  })
                }}
              </span>
            </div>
          </div>
        </div>

        <!-- Footer / Status bar -->
        <div
          class="flex h-12 items-center justify-between border-t border-border-default px-4"
        >
          <div class="flex items-center gap-2 text-sm">
            <template v-if="isInProgress">
              <i
                class="icon-[lucide--loader-circle] size-4 animate-spin text-muted-foreground"
              />
              <span class="font-bold text-base-foreground">{{
                currentJobName
              }}</span>
            </template>
            <template v-else-if="failedJobs.length > 0">
              <i
                class="icon-[lucide--circle-alert] size-4 text-destructive-background"
              />
              <span class="font-bold text-base-foreground">
                {{
                  t('progressToast.downloadsFailed', {
                    count: failedJobs.length
                  })
                }}
              </span>
            </template>
            <template v-else>
              <i class="icon-[lucide--check-circle] size-4 text-jade-600" />
              <span class="font-bold text-base-foreground">
                {{ t('progressToast.allDownloadsCompleted') }}
              </span>
            </template>
          </div>

          <div class="flex items-center gap-2">
            <!-- Progress Count -->
            <span v-if="isInProgress" class="text-sm text-muted-foreground">
              {{ completedCount }} {{ t('g.progressCountOf') }} {{ totalCount }}
            </span>

            <div class="flex items-center">
              <!-- Expand/Collapse Button -->
              <button
                class="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary-background-hover hover:text-base-foreground"
                @click.stop="toggle"
              >
                <i
                  :class="[
                    'size-4',
                    isExpanded
                      ? 'icon-[lucide--chevron-down]'
                      : 'icon-[lucide--chevron-up]'
                  ]"
                />
              </button>

              <!-- Close Button (only when all downloads completed) -->
              <button
                v-if="!isInProgress"
                class="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary-background-hover hover:text-base-foreground"
                @click.stop="closeDialog"
              >
                <i class="icon-[lucide--x] size-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
