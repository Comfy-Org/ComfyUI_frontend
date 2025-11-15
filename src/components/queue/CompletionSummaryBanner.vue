<template>
  <button
    type="button"
    class="group flex w-full items-center justify-between gap-3 rounded-lg border-0 bg-[var(--secondary-background)] p-1 text-left transition-colors duration-200 ease-in-out hover:cursor-pointer hover:bg-[var(--secondary-background-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary-background)]"
  >
    <span class="inline-flex items-center gap-2">
      <span v-if="props.mode === 'allFailed'" class="inline-flex items-center">
        <i
          class="ml-1 icon-[lucide--circle-alert] block size-4 leading-none"
          :class="'text-[var(--destructive-background)]'"
        />
      </span>

      <span class="inline-flex items-center gap-2">
        <span
          v-if="props.mode !== 'allFailed'"
          class="relative inline-flex h-6 items-center"
        >
          <span
            v-for="(url, idx) in props.thumbnailUrls"
            :key="url + idx"
            class="inline-block h-6 w-6 overflow-hidden rounded-[6px] border-0 bg-[var(--secondary-background)]"
            :style="{ marginLeft: idx === 0 ? '0' : '-12px' }"
          >
            <img :src="url" alt="preview" class="h-full w-full object-cover" />
          </span>
        </span>

        <span class="text-[14px] font-normal text-[var(--text-primary)]">
          <template v-if="props.mode === 'allSuccess'">
            <i18n-t
              keypath="sideToolbar.queueProgressOverlay.jobsCompleted"
              :plural="props.completedCount"
            >
              <template #count>
                <span class="font-bold">{{ props.completedCount }}</span>
              </template>
            </i18n-t>
          </template>
          <template v-else-if="props.mode === 'mixed'">
            <i18n-t
              keypath="sideToolbar.queueProgressOverlay.jobsCompleted"
              :plural="props.completedCount"
            >
              <template #count>
                <span class="font-bold">{{ props.completedCount }}</span>
              </template>
            </i18n-t>
            <span>, </span>
            <i18n-t
              keypath="sideToolbar.queueProgressOverlay.jobsFailed"
              :plural="props.failedCount"
            >
              <template #count>
                <span class="font-bold">{{ props.failedCount }}</span>
              </template>
            </i18n-t>
          </template>
          <template v-else>
            <i18n-t
              keypath="sideToolbar.queueProgressOverlay.jobsFailed"
              :plural="props.failedCount"
            >
              <template #count>
                <span class="font-bold">{{ props.failedCount }}</span>
              </template>
            </i18n-t>
          </template>
        </span>
      </span>
    </span>

    <span
      class="flex items-center justify-center rounded p-1 text-[var(--text-secondary)] transition-colors duration-200 ease-in-out"
    >
      <i class="icon-[lucide--chevron-down] block size-4 leading-none" />
    </span>
  </button>
</template>

<script setup lang="ts">
import { defineProps, withDefaults } from 'vue'

type Props = {
  mode: 'allSuccess' | 'mixed' | 'allFailed'
  completedCount: number
  failedCount: number
  thumbnailUrls?: string[]
}

const props = withDefaults(defineProps<Props>(), {
  thumbnailUrls: () => []
})
</script>
