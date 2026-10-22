<script setup lang="ts">
import { useIntersectionObserver } from '@vueuse/core'
import { useTemplateRef } from 'vue'

import type { HubRowView } from '@/scripts/hub-analytics'
import { captureHubRowView } from '@/scripts/hub-analytics'

const { view } = defineProps<{ view: HubRowView }>()

const marker = useTemplateRef<HTMLElement>('marker')
let seen = false
const { stop } = useIntersectionObserver(
  () => marker.value?.parentElement,
  ([entry]) => {
    if (seen || !entry?.isIntersecting) return
    seen = true
    stop()
    captureHubRowView(view)
  },
  { rootMargin: '0px 0px -25% 0px' }
)
</script>

<template>
  <span ref="marker" aria-hidden="true" class="block h-0" />
</template>
