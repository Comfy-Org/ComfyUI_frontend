<script setup lang="ts">
import type { RelightMask } from '../../../lib/workshop/relight/lights'

const { mask } = defineProps<{ mask: RelightMask }>()
</script>

<template>
  <div
    class="pointer-events-none absolute rounded-[50%] border border-dashed border-primary-comfy-yellow/80 bg-primary-comfy-yellow/10"
    :style="{
      left: `${(mask.cx - mask.rx) * 100}%`,
      top: `${(mask.cy - mask.ry) * 100}%`,
      width: `${mask.rx * 200}%`,
      height: `${mask.ry * 200}%`
    }"
    data-testid="relight-mask"
    aria-hidden="true"
  >
    <span
      class="absolute top-0 left-1/2 -translate-1/2 rounded-full bg-primary-comfy-yellow px-2 py-0.5 text-[10px] font-medium whitespace-nowrap text-primary-comfy-ink"
      >{{ mask.name }}</span
    >
  </div>
</template>
