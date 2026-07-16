<script setup lang="ts">
import { reactiveOmit } from '@vueuse/core'
import type { ListboxGroupProps } from 'reka-ui'
import { ListboxGroup, ListboxGroupLabel, useId } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { computed, onMounted, onUnmounted } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import { provideCommandGroupContext, useCommand } from '.'

const props = defineProps<
  ListboxGroupProps & { class?: HTMLAttributes['class']; heading?: string }
>()
const delegatedProps = reactiveOmit(props, 'class')
const { allGroups, filterState } = useCommand()
const id = useId()
const isRender = computed(() =>
  !filterState.search ? true : filterState.filtered.groups.has(id)
)
provideCommandGroupContext({ id })
onMounted(() => {
  if (!allGroups.value.has(id)) allGroups.value.set(id, new Set())
})
onUnmounted(() => {
  allGroups.value.delete(id)
})
</script>

<template>
  <ListboxGroup
    :id="id"
    v-bind="delegatedProps"
    :class="cn('overflow-hidden p-1 text-base-foreground', props.class)"
    :hidden="isRender ? undefined : true"
  >
    <ListboxGroupLabel
      v-if="heading"
      class="px-2 py-1.5 text-xs font-medium text-muted-foreground"
    >
      {{ heading }}
    </ListboxGroupLabel>
    <slot />
  </ListboxGroup>
</template>
