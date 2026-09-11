<script setup lang="ts">
import { useMounted } from '@vueuse/core'

import { useWorkshopEnabled } from '../../scripts/posthog'

const enabled = useWorkshopEnabled()
const mounted = useMounted()
</script>

<template>
  <div v-show="mounted && enabled">
    <slot />
  </div>
  <div v-if="!mounted || !enabled">
    <slot name="fallback" />
  </div>
</template>
