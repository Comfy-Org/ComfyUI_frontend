<script setup lang="ts">
import type { ToggleGroupRootEmits, ToggleGroupRootProps } from 'reka-ui'
import { ToggleGroupRoot, useForwardPropsEmits } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { computed, provide } from 'vue'

import { cn } from '@/utils/tailwindUtil'

import type { ToggleGroupVariants } from './toggleGroup.variants'
import { toggleGroupVariants } from './toggleGroup.variants'

interface Props extends ToggleGroupRootProps {
  class?: HTMLAttributes['class']
  variant?: ToggleGroupVariants['variant']
}

const { class: className, variant = 'default', ...restProps } = defineProps<Props>()

const emits = defineEmits<ToggleGroupRootEmits>()

const delegatedProps = computed(() => restProps)

const forwarded = useForwardPropsEmits(delegatedProps, emits)

provide('toggleGroupVariant', variant)
</script>

<template>
  <ToggleGroupRoot
    v-bind="forwarded"
    :class="cn(toggleGroupVariants({ variant }), className)"
  >
    <slot />
  </ToggleGroupRoot>
</template>
