<script setup lang="ts">
import { reactiveOmit } from '@vueuse/core'
import type { CheckboxRootEmits, CheckboxRootProps } from 'reka-ui'
import { CheckboxIndicator, CheckboxRoot, useForwardPropsEmits } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import { checkboxClass, checkboxIndicator } from '#control-styles'

const props = defineProps<
  CheckboxRootProps & { class?: HTMLAttributes['class'] }
>()
const emits = defineEmits<CheckboxRootEmits>()
const forwarded = useForwardPropsEmits(reactiveOmit(props, 'class'), emits)
</script>

<template>
  <CheckboxRoot
    v-slot="slotProps"
    v-bind="forwarded"
    data-slot="checkbox"
    :class="cn(checkboxClass, props.class)"
  >
    <CheckboxIndicator class="flex items-center justify-center">
      <slot v-bind="slotProps">
        <i
          :class="
            checkboxIndicator[
              slotProps.state === 'indeterminate' ? 'indeterminate' : 'checked'
            ]
          "
        />
      </slot>
    </CheckboxIndicator>
  </CheckboxRoot>
</template>
