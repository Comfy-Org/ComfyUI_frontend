<script setup lang="ts">
import { useImage } from '@vueuse/core'
import { computed } from 'vue'

import ZoomPane from '@/components/ui/ZoomPane.vue'
import { useExecutionStatus } from '@/renderer/extensions/linearMode/useExecutionStatus'
import { cn } from '@comfyorg/tailwind-utils'

const { executionStatusMessage } = useExecutionStatus()

defineOptions({ inheritAttrs: false })

const { src, showSize = true } = defineProps<{
  src: string
  mobile?: boolean
  label?: string
  showSize?: boolean
}>()

const { state: imageState, isReady } = useImage(
  computed(() => ({ src, alt: '' }))
)

const width = computed(() =>
  showSize && isReady.value && imageState.value
    ? imageState.value.naturalWidth || null
    : null
)
const height = computed(() =>
  showSize && isReady.value && imageState.value
    ? imageState.value.naturalHeight || null
    : null
)
</script>
<template>
  <ZoomPane
    v-if="!mobile"
    v-slot="slotProps"
    :class="cn('w-full flex-1', $attrs.class as string)"
  >
    <img :src v-bind="slotProps" class="size-full object-contain" />
  </ZoomPane>
  <img v-else class="grow object-contain contain-size" :src />
  <span
    v-if="executionStatusMessage"
    class="animate-pulse self-center text-muted md:z-10"
  >
    {{ executionStatusMessage }}
  </span>
  <span v-else-if="width && height" class="self-center md:z-10">
    {{ `${width} x ${height}` }}
    <template v-if="label"> | {{ label }}</template>
  </span>
</template>
