<script setup lang="ts">
import { computed } from 'vue'

import WorkshopGate from '@/components/workshop/WorkshopGate.vue'
import type { HubBannerContent } from '@/data/hubBanner'
import type { Locale } from '@/i18n/translations'
import { usePreviewSwitch } from '@/lib/workshop/preview-switches'
import { useWorkshopWorkflowsEnabled } from '@/scripts/posthog'
import HubEntriesBanner from './HubEntriesBanner.vue'
import HubPickRemixRun from './HubPickRemixRun.vue'

const { locale = 'en', content } = defineProps<{
  locale?: Locale
  content: HubBannerContent
}>()

const pickRemixRun = usePreviewSwitch('home-hub-pick-remix-run')
const workflowsEnabled = useWorkshopWorkflowsEnabled()
const workflows = computed(() =>
  workflowsEnabled.value ? content.workflows : []
)

const marqueeRows = computed(() => {
  if (workflows.value.length) return [workflows.value, content.models]
  const half = Math.ceil(content.models.length / 2)
  return [content.models.slice(0, half), content.models.slice(half)]
})
</script>

<template>
  <WorkshopGate>
    <HubPickRemixRun v-if="pickRemixRun" :locale :rows="marqueeRows" />
    <HubEntriesBanner v-else :locale :content />
  </WorkshopGate>
</template>
