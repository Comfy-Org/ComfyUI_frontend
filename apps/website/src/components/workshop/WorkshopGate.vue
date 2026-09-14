<script setup lang="ts">
import { useMounted } from '@vueuse/core'
import { ref, watch } from 'vue'

import {
  useWorkshopEnabled,
  useWorkshopEnabledSettled
} from '../../scripts/posthog'

const { keepMounted = false } = defineProps<{ keepMounted?: boolean }>()
const enabled = useWorkshopEnabled()
const settled = useWorkshopEnabledSettled()
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
  <div
    v-if="activated && (enabled || keepMounted)"
    v-show="enabled"
    :aria-hidden="!enabled"
  >
    <slot />
  </div>
  <div v-if="!mounted || (settled && !enabled)">
    <slot name="fallback" />
  </div>
</template>
