<script setup lang="ts">
import { useImage } from '@vueuse/core'
import { computed } from 'vue'

import ZoomPane from '@/components/ui/ZoomPane.vue'
import { cn } from '@/utils/tailwindUtil'

defineOptions({ inheritAttrs: false })

const { src } = defineProps<{
  src: string
  mobile?: boolean
}>()

const { state } = useImage({ src })

const width = computed(() => state.value?.naturalWidth?.toString() ?? '')
const height = computed(() => state.value?.naturalHeight?.toString() ?? '')
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
  <span class="self-center md:z-10" v-text="`${width} x ${height}`" />
</template>
