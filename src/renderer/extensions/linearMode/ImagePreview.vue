<script setup lang="ts">
import { ref, useTemplateRef } from 'vue'

import ZoomPane from '@/components/ui/ZoomPane.vue'
import { cn } from '@/utils/tailwindUtil'

defineOptions({ inheritAttrs: false })

const { src } = defineProps<{
  src: string
  mobile?: boolean
  label?: string
}>()

const imageRef = useTemplateRef('imageRef')
const width = ref('')
const height = ref('')
</script>
<template>
  <ZoomPane
    v-if="!mobile"
    v-slot="slotProps"
    :class="cn('w-full flex-1', $attrs.class as string)"
  >
    <img
      ref="imageRef"
      :src
      v-bind="slotProps"
      class="size-full object-contain"
      @load="
        () => {
          if (!imageRef) return
          width = `${imageRef.naturalWidth}`
          height = `${imageRef.naturalHeight}`
        }
      "
    />
  </ZoomPane>
  <img
    v-else
    ref="imageRef"
    class="grow object-contain contain-size"
    :src
    @load="
      () => {
        if (!imageRef) return
        width = `${imageRef.naturalWidth}`
        height = `${imageRef.naturalHeight}`
      }
    "
  />
  <span class="self-center md:z-10">
    {{ `${width} x ${height}` }}
    <template v-if="label"> | {{ label }}</template>
  </span>
</template>
