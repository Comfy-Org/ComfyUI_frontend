<script setup lang="ts">
import { useMounted } from '@vueuse/core'
import { ref, watch } from 'vue'

import { useWorkshopEnabled } from '../../scripts/posthog'

const enabled = useWorkshopEnabled()
const mounted = useMounted()
const activated = ref(false)

watch(
  () => mounted.value && enabled.value,
  (visible) => {
    if (visible) activated.value = true
  },
  { once: true }
)
</script>

<template>
  <div v-if="activated" v-show="enabled" :aria-hidden="!enabled">
    <slot />
  </div>
  <div v-if="!mounted || !enabled">
    <slot name="fallback" />
  </div>
</template>
