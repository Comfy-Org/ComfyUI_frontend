<script setup lang="ts">
import type { AgencyDraft, AgencyDraftLabels } from './draftTypes'

defineProps<{ agency: AgencyDraft; labels: AgencyDraftLabels }>()
</script>

<template>
  <span
    v-if="agency.logoSrc"
    role="img"
    :aria-label="agency.name"
    class="block h-10 w-40 shrink-0 bg-primary-warm-white mask-contain mask-center mask-no-repeat"
    :style="{
      maskImage: `url('${agency.logoSrc}')`,
      maskSize: agency.logoMaskSize,
      maskPosition: agency.logoMaskPosition,
      maskMode: agency.logoMaskMode
    }"
  />
  <span
    v-else
    class="rounded-2xl border border-dashed border-primary-comfy-canvas/40 p-3 text-xs text-primary-comfy-canvas"
    >{{ labels.pendingLogo }}</span
  >
</template>
