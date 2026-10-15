<script setup lang="ts">
import { getLogoPath } from '@/lib/hub/model-logos'

const { provider } = defineProps<{ provider: string }>()

const logo = getLogoPath(provider)
</script>

<template>
  <span
    class="grid size-7 shrink-0 place-items-center rounded-lg bg-transparency-white-t8 text-xs font-semibold"
    aria-hidden="true"
  >
    <span
      v-if="logo"
      class="size-3.5 bg-current mask-contain mask-center mask-no-repeat"
      :style="{ maskImage: `url(${logo})` }"
    />
    <template v-else>{{ provider.charAt(0).toUpperCase() }}</template>
  </span>
</template>
