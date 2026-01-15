<script setup lang="ts">
import { reactiveOmit } from '@vueuse/core'
import type { TagsInputItemDeleteProps } from 'reka-ui'
import { TagsInputItemDelete, useForwardProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import { cn } from '@/utils/tailwindUtil'

const props = defineProps<
  // eslint-disable-next-line vue/no-unused-properties
  TagsInputItemDeleteProps & { class?: HTMLAttributes['class'] }
>()

const delegatedProps = reactiveOmit(props, 'class')

const forwardedProps = useForwardProps(delegatedProps)
</script>

<template>
  <TagsInputItemDelete
    v-bind="forwardedProps"
    :as="Button"
    variant="textonly"
    size="icon-sm"
    :class="
      cn(
        'opacity-60 hover:bg-transparent hover:opacity-100 transition-[opacity,width] duration-150 w-4 data-[disabled]:w-0 data-[disabled]:opacity-0 data-[disabled]:pointer-events-none overflow-hidden',
        props.class
      )
    "
  >
    <slot>
      <i class="icon-[lucide--x] size-4" />
    </slot>
  </TagsInputItemDelete>
</template>
