<script setup lang="ts">
import { computed } from 'vue'

import WorkshopGate from '@/components/workshop/WorkshopGate.vue'
import type { HubBannerContent, HubBannerTile } from '@/data/hubBanner'
import type { Locale } from '@/i18n/translations'
import { usePreviewSwitch } from '@/lib/workshop/preview-switches'
import { useWorkshopWorkflowsEnabled } from '@/scripts/posthog'
import HubMosaicBanner from './HubMosaicBanner.vue'
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

const MOSAIC_SIZE = 9

function interleave(
  first: readonly HubBannerTile[],
  second: readonly HubBannerTile[]
): HubBannerTile[] {
  return Array.from(
    { length: Math.max(first.length, second.length) },
    (_, index) => [first[index], second[index]]
  )
    .flat()
    .filter((tile) => tile !== undefined)
}

const mosaicTiles = computed(() =>
  interleave(content.models, workflows.value).slice(0, MOSAIC_SIZE)
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
    <HubMosaicBanner v-else :locale :tiles="mosaicTiles" />
  </WorkshopGate>
</template>
