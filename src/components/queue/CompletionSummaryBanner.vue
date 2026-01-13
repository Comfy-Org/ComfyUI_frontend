<template>
  <Button
    variant="secondary"
    size="lg"
    class="group w-full justify-between gap-3 p-1 text-left font-normal hover:cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-background"
    :aria-label="props.ariaLabel"
    @click="emit('click', $event)"
  >
    <span class="inline-flex items-center gap-2">
      <span v-if="props.mode === 'allFailed'" class="inline-flex items-center">
        <i
          class="ml-1 icon-[lucide--circle-alert] block size-4 leading-none text-destructive-background"
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
            class="inline-block h-6 w-6 overflow-hidden rounded-[6px] border-0 bg-secondary-background"
            :style="{ marginLeft: idx === 0 ? '0' : '-12px' }"
          >
            <img
              :src="url"
              :alt="$t('sideToolbar.queueProgressOverlay.preview')"
              class="h-full w-full object-cover"
            />
          </span>
        </span>

        <span class="text-[14px] font-normal text-text-primary">
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
      class="flex items-center justify-center rounded p-1 text-text-secondary transition-colors duration-200 ease-in-out"
    >
      <i class="icon-[lucide--chevron-down] block size-4 leading-none" />
    </span>
  </Button>
</template>

<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'
import type {
  CompletionSummary,
  CompletionSummaryMode
} from '@/composables/queue/useCompletionSummary'

type Props = {
  mode: CompletionSummaryMode
  completedCount: CompletionSummary['completedCount']
  failedCount: CompletionSummary['failedCount']
  thumbnailUrls?: CompletionSummary['thumbnailUrls']
  ariaLabel?: string
}

const props = withDefaults(defineProps<Props>(), {
  thumbnailUrls: () => []
})

const emit = defineEmits<{
  (e: 'click', event: MouseEvent): void
}>()
</script>
