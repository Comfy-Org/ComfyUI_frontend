<script setup lang="ts">
import { reactiveOmit } from '@vueuse/core'
import type { ListboxFilterProps } from 'reka-ui'
import { ListboxFilter, useForwardProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import { useCommand } from '.'

defineOptions({ inheritAttrs: false })

const props = defineProps<
  ListboxFilterProps & { class?: HTMLAttributes['class'] }
>()
const delegatedProps = reactiveOmit(props, 'class')
const forwardedProps = useForwardProps(delegatedProps)
const { filterState } = useCommand()
</script>

<template>
  <div class="flex items-center border-b border-border-default px-3">
    <i
      class="icon-[lucide--search] mr-2 size-4 shrink-0 text-muted-foreground"
    />
    <ListboxFilter
      v-bind="{ ...forwardedProps, ...$attrs }"
      v-model="filterState.search"
      auto-focus
      :class="
        cn(
          'flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50',
          props.class
        )
      "
    />
  </div>
</template>
