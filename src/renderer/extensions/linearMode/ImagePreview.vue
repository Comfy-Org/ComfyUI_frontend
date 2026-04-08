<script setup lang="ts">
import { ref, useTemplateRef } from 'vue'

import ZoomPane from '@/components/ui/ZoomPane.vue'
import { cn } from '@/utils/tailwindUtil'

defineOptions({ inheritAttrs: false })

const { src } = defineProps<{
  src: string
  mobile?: boolean
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
    class="min-h-0 flex-1 object-contain"
    :src
    @load="
      () => {
        if (!imageRef) return
        width = `${imageRef.naturalWidth}`
        height = `${imageRef.naturalHeight}`
      }
    "
  />
  <span
    v-if="!mobile"
    class="self-end pr-2 md:z-10"
    v-text="`${width} x ${height}`"
  />
</template>
