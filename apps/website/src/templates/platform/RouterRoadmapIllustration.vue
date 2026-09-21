<script setup lang="ts">
import type { RouterRoadmapCardId } from '../../scripts/posthog'

const { card } = defineProps<{ card: RouterRoadmapCardId }>()
</script>

<template>
  <svg
    v-if="card === 'workflow'"
    viewBox="0 0 300 160"
    class="size-full"
    fill="none"
  >
    <path d="M55 80h62M183 80h62" stroke="#6858a8" stroke-width="3" />
    <circle cx="42" cy="80" r="20" fill="#4b3e78" />
    <rect x="117" y="56" width="66" height="48" rx="14" fill="#efff45" />
    <circle cx="258" cy="80" r="20" fill="#4b3e78" />
  </svg>
  <svg
    v-else-if="card === 'strategy'"
    viewBox="0 0 300 160"
    class="size-full"
    fill="none"
  >
    <path
      d="M48 80h58M106 80c45 0 45-45 88-45M106 80h88M106 80c45 0 45 45 88 45"
      stroke="#6858a8"
      stroke-width="3"
      stroke-dasharray="5 8"
    />
    <circle cx="38" cy="80" r="15" fill="#efff45" />
    <rect x="194" y="20" width="68" height="30" rx="10" fill="#4b3e78" />
    <rect x="194" y="65" width="68" height="30" rx="10" fill="#efff45" />
    <rect x="194" y="110" width="68" height="30" rx="10" fill="#4b3e78" />
  </svg>
  <svg
    v-else-if="card === 'use-case'"
    viewBox="0 0 300 160"
    class="size-full"
    fill="none"
  >
    <path
      d="M96 35c55 0 55 45 110 45M96 80h110M96 125c55 0 55-45 110-45"
      stroke="#6858a8"
      stroke-width="3"
    />
    <rect x="28" y="20" width="68" height="30" rx="10" fill="#4b3e78" />
    <rect x="28" y="65" width="68" height="30" rx="10" fill="#4b3e78" />
    <rect x="28" y="110" width="68" height="30" rx="10" fill="#4b3e78" />
    <rect x="206" y="56" width="66" height="48" rx="14" fill="#efff45" />
  </svg>
  <svg v-else viewBox="0 0 300 160" class="size-full" fill="none">
    <path d="M120 80h34M220 80h26" stroke="#6858a8" stroke-width="3" />
    <circle cx="48" cy="80" r="22" fill="#efff45" />
    <circle cx="48" cy="80" r="8" fill="#1d1723" />
    <rect x="66" y="75" width="54" height="10" rx="3" fill="#efff45" />
    <rect x="98" y="85" width="7" height="10" rx="2" fill="#efff45" />
    <rect x="110" y="85" width="7" height="12" rx="2" fill="#efff45" />
    <rect x="154" y="56" width="66" height="48" rx="14" fill="#4b3e78" />
    <circle cx="266" cy="80" r="20" fill="#4b3e78" />
  </svg>
</template>
