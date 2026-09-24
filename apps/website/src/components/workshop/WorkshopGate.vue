<script setup lang="ts">
import { useMounted } from '@vueuse/core'
import { computed, ref, watch } from 'vue'

import {
  useWorkshopEnabled,
  useWorkshopEnabledSettled
} from '../../scripts/posthog'

const { keepMounted = false, allowed = true } = defineProps<{
  keepMounted?: boolean
  allowed?: boolean
}>()
const enabled = useWorkshopEnabled()
const settled = useWorkshopEnabledSettled()
const mounted = useMounted()

type GateView = 'loading' | 'granted' | 'denied'
const view = computed<GateView>(() =>
  !mounted.value || !settled.value
    ? 'loading'
    : enabled.value && allowed
      ? 'granted'
      : 'denied'
)

const granted = ref(false)
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
    v-if="granted && ((enabled && allowed) || keepMounted)"
    v-show="enabled && allowed"
    :aria-hidden="!enabled || !allowed"
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
