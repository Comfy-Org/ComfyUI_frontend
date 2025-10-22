<template>
  <button
    type="button"
    class="group flex w-full items-center justify-between gap-[calc(var(--spacing-spacing-xs)+var(--spacing-spacing-xss))] rounded-lg border border-[var(--color-charcoal-400)] bg-[var(--color-charcoal-800)] p-[var(--spacing-spacing-xxs)] text-left transition-colors duration-200 ease-in-out hover:cursor-pointer hover:border-[var(--color-charcoal-300)] hover:bg-[var(--color-charcoal-700)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-slate-200)]"
  >
    <span class="inline-flex items-center gap-[var(--spacing-spacing-xs)]">
      <span v-if="props.mode === 'allFailed'" class="inline-flex items-center">
        <i
          class="mr-[var(--spacing-spacing-xs)] icon-[lucide--circle-alert] block size-4 leading-none"
          :class="'text-[var(--color-red-200)]'"
        />
      </span>

      <span class="inline-flex items-center gap-[var(--spacing-spacing-xs)]">
        <span
          v-if="props.mode !== 'allFailed'"
          class="relative inline-flex h-6 items-center"
        >
          <span
            v-for="(url, idx) in props.thumbnailUrls"
            :key="url + idx"
            class="inline-block h-6 w-6 overflow-hidden rounded-[6px] border-2 border-[var(--color-charcoal-800)] bg-[var(--color-charcoal-800)]"
            :style="{ marginLeft: idx === 0 ? '0' : '-12px' }"
          >
            <img :src="url" alt="preview" class="h-full w-full object-cover" />
          </span>
        </span>

        <span class="text-[14px] font-normal text-white">
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
      class="flex items-center justify-center rounded p-[var(--spacing-spacing-xss)] text-[var(--color-slate-100)] transition-colors duration-200 ease-in-out group-hover:bg-[var(--color-charcoal-600)] group-hover:text-white"
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
