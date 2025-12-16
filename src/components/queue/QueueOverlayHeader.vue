<template>
  <div
    class="flex h-12 items-center justify-between gap-2 border-b border-interface-stroke px-2"
  >
    <div class="px-2 text-[14px] font-normal text-text-primary">
      <span>{{ headerTitle }}</span>
      <span
        v-if="showConcurrentIndicator"
        class="ml-4 inline-flex items-center gap-1 text-blue-100"
      >
        <span class="inline-block size-2 rounded-full bg-blue-100" />
        <span>
          <span class="font-bold">{{ concurrentWorkflowCount }}</span>
          <span class="ml-1">{{
            t('sideToolbar.queueProgressOverlay.running')
          }}</span>
        </span>
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{
  headerTitle: string
  showConcurrentIndicator: boolean
  concurrentWorkflowCount: number
}>()

const { t } = useI18n()
</script>
