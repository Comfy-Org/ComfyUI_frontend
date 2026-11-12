<script setup lang="ts">
import { useAttrsClass } from '@comfyorg/design-system/lib/composables/useAttrsClass'
import { cn } from '@comfyorg/tailwind-utils'
import { NODE_CONTENT_GAP } from './imagePreviewLayout'

defineOptions({ inheritAttrs: false })
const { attrsClass, attrsWithoutClass } = useAttrsClass()
</script>

<template>
  <div
    v-bind="attrsWithoutClass"
    :class="cn('flex flex-1 flex-col bg-node pt-1 pb-3', attrsClass)"
    :style="{ rowGap: `${NODE_CONTENT_GAP}px` }"
  >
    <slot />
  </div>
</template>
