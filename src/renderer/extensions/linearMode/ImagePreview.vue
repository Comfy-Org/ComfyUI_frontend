<script setup lang="ts">
import { useImage } from '@vueuse/core'
import { computed } from 'vue'

import ZoomPane from '@/components/ui/ZoomPane.vue'

const { src } = defineProps<{
  src: string
  mobile?: boolean
}>()

const { state } = useImage({ src })

const width = computed(() => state.value?.naturalWidth?.toString() ?? '')
const height = computed(() => state.value?.naturalHeight?.toString() ?? '')
</script>
<template>
  <ZoomPane v-if="!mobile" v-slot="slotProps" class="flex-1 w-full">
    <img :src v-bind="slotProps" class="h-full object-contain w-full" />
  </ZoomPane>
  <img v-else class="w-full" :src />
  <span class="self-center md:z-10" v-text="`${width} x ${height}`" />
</template>
