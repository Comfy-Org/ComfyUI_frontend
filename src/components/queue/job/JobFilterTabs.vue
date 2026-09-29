<template>
  <div class="min-w-0 flex-1 overflow-x-auto">
    <div class="inline-flex items-center gap-1 whitespace-nowrap">
      <Button
        v-for="tab in visibleJobTabs"
        :key="tab"
        :variant="selectedJobTab === tab ? 'secondary' : 'muted-textonly'"
        size="md"
        @click="$emit('update:selectedJobTab', tab)"
      >
        {{ t(jobTabLabelKeys[tab]) }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import {
  getVisibleJobTabs,
  jobTabLabelKeys
} from '@/composables/queue/useJobList'
import type { JobTab } from '@/composables/queue/useJobList'

const { selectedJobTab, hasFailedJobs } = defineProps<{
  selectedJobTab: JobTab
  hasFailedJobs: boolean
}>()

defineEmits<{
  (e: 'update:selectedJobTab', value: JobTab): void
}>()

const { t } = useI18n()

const visibleJobTabs = computed(() => getVisibleJobTabs(hasFailedJobs))
</script>
