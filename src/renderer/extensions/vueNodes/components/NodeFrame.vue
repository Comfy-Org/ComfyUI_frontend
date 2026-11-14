<script setup lang="ts">
import { useTemplateRef } from 'vue'
import type { CSSProperties } from 'vue'

import { useAttrsClass } from '@comfyorg/design-system/lib/composables/useAttrsClass'
import { cn } from '@comfyorg/tailwind-utils'
import type { ClassValue } from '@comfyorg/tailwind-utils'

const { containerClass, containerStyle, contentVisibility } = defineProps<{
  containerClass?: ClassValue
  containerStyle?: CSSProperties
  contentVisibility?: boolean
}>()
defineOptions({ inheritAttrs: false })
const { attrsClass, attrsWithoutClass } = useAttrsClass()
const element = useTemplateRef<HTMLDivElement>('element')
defineExpose({ element })
</script>

<template>
  <div
    ref="element"
    v-bind="attrsWithoutClass"
    :class="
      cn(
        'group/node lg-node absolute isolate flex touch-none flex-col text-xs text-node-foreground contain-layout contain-style',
        attrsClass
      )
    "
  >
    <slot name="before" />
    <div
      :class="
        cn(
          'relative isolate flex flex-1 flex-col',
          contentVisibility &&
            '[contain-intrinsic-size:auto_var(--node-width)_auto_var(--node-height)] group-data-measured/node:[content-visibility:auto] group-data-measured/node:[overflow-clip-margin:16px]'
        )
      "
    >
      <div
        data-testid="node-inner-wrapper"
        :class="cn('flex flex-1 flex-col', containerClass)"
        :style="containerStyle"
      >
        <slot />
      </div>
      <slot name="after" />
    </div>
  </div>
</template>
