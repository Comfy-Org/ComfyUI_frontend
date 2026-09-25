<script setup lang="ts">
import { useMounted } from '@vueuse/core'
import { computed, ref, watch } from 'vue'

import {
  useWorkshopEnabled,
  useWorkshopEnabledSettled
} from '../../scripts/posthog'

const {
  keepMounted = false,
  allowed = true,
  retainGranted = false,
  allowRecovery = false
} = defineProps<{
  keepMounted?: boolean
  allowed?: boolean
  retainGranted?: boolean
  allowRecovery?: boolean
}>()
const enabled = useWorkshopEnabled()
const settled = useWorkshopEnabledSettled()
const mounted = useMounted()
const granted = ref(false)

type GateView = 'loading' | 'granted' | 'denied'
const view = computed<GateView>(() =>
  (mounted.value && allowRecovery) || (granted.value && retainGranted)
    ? 'granted'
    : !mounted.value || !settled.value
      ? 'loading'
      : enabled.value && allowed
        ? 'granted'
        : 'denied'
)

watch(
  () => view.value === 'granted',
  (isGranted) => {
    if (isGranted) granted.value = true
  },
  { once: true }
)
</script>

<template>
  <div
    v-if="granted && (view === 'granted' || keepMounted)"
    v-show="view === 'granted'"
    :aria-hidden="view !== 'granted'"
  >
    <slot />
  </div>
  <div v-if="view === 'loading'">
    <slot name="loading" />
  </div>
  <div v-else-if="view === 'denied'">
    <slot name="fallback" />
  </div>
</template>
