<script setup lang="ts">
import { reactiveOmit, useCurrentElement } from '@vueuse/core'
import type { ListboxItemEmits, ListboxItemProps } from 'reka-ui'
import { ListboxItem, useForwardPropsEmits, useId } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { computed, onMounted, onUnmounted, ref } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import { useCommand, useCommandGroup } from '.'

const props = defineProps<
  ListboxItemProps & { class?: HTMLAttributes['class'] }
>()
const emits = defineEmits<ListboxItemEmits>()
const delegatedProps = reactiveOmit(props, 'class')
const forwarded = useForwardPropsEmits(delegatedProps, emits)

const id = useId()
const { filterState, allItems, allGroups } = useCommand()
const groupContext = useCommandGroup()

const isRender = computed(() => {
  if (!filterState.search) return true
  const filteredCurrentItem = filterState.filtered.items.get(id)
  if (filteredCurrentItem === undefined) return true
  return filteredCurrentItem > 0
})

const itemRef = ref()
const currentElement = useCurrentElement(itemRef)
onMounted(() => {
  if (!(currentElement.value instanceof HTMLElement)) return
  allItems.value.set(
    id,
    currentElement.value.textContent ?? props?.value!.toString()
  )
  const groupId = groupContext?.id
  if (groupId) {
    if (!allGroups.value.has(groupId)) {
      allGroups.value.set(groupId, new Set([id]))
    } else {
      allGroups.value.get(groupId)?.add(id)
    }
  }
})
onUnmounted(() => {
  allItems.value.delete(id)
})
</script>

<template>
  <ListboxItem
    v-if="isRender"
    :id="id"
    v-bind="forwarded"
    ref="itemRef"
    :class="
      cn(
        'relative flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none select-none data-[highlighted]:bg-secondary-background-hover data-[highlighted]:text-base-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
        props.class
      )
    "
  >
    <slot />
  </ListboxItem>
</template>
