<!--
  Floating indicator that displays the estimated VRAM requirement
  for the currently loaded workflow graph.
-->
<template>
  <div
    v-if="vramEstimate > 0"
    class="pointer-events-auto absolute bottom-3 right-3 z-10 inline-flex items-center gap-1.5 rounded-lg bg-zinc-500/40 px-2.5 py-1.5 text-xs font-medium text-white/90 backdrop-blur-sm"
    :title="t('templateWorkflows.vramEstimateTooltip')"
  >
    <i class="icon-[lucide--cpu] h-3.5 w-3.5" />
    {{ formatSize(vramEstimate) }}
  </div>
</template>

<script setup lang="ts">
import { formatSize } from '@/utils/formatUtil'
import { ref, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'

import { estimateWorkflowVram } from '@/composables/useVramEstimation'
import { app } from '@/scripts/app'

const { t } = useI18n()

const vramEstimate = ref(0)

watchEffect(() => {
  vramEstimate.value = estimateWorkflowVram(app.rootGraph)
})
</script>
