<script setup lang="ts">
import { refDebounced } from '@vueuse/core'
import { ref, toRef, watch } from 'vue'

import { cn } from '@/utils/tailwindUtil'

const props = withDefaults(
  defineProps<{
    searcher?: (
      query: string,
      onCleanup: (cleanupFn: () => void) => void
    ) => Promise<void>
    updateKey?: string | number | symbol | (() => unknown)
  }>(),
  {
    searcher: async () => {}
  }
)

const searchQuery = defineModel<string>({ default: '' })

const isQuerying = ref(false)
const debouncedSearchQuery = refDebounced(searchQuery, 700, {
  maxWait: 700
})
watch(searchQuery, (value) => {
  isQuerying.value = value !== debouncedSearchQuery.value
})

const updateKey =
  typeof props.updateKey === 'function'
    ? props.updateKey
    : toRef(props, 'updateKey')

watch(
  [debouncedSearchQuery, updateKey],
  (_, __, onCleanup) => {
    let isCleanup = false
    let cleanupFn: undefined | (() => void)
    onCleanup(() => {
      isCleanup = true
      cleanupFn?.()
    })

    void props
      .searcher(debouncedSearchQuery.value, (cb) => (cleanupFn = cb))
      .finally(() => {
        if (!isCleanup) isQuerying.value = false
      })
  },
  { immediate: true }
)
</script>

<template>
  <label
    :class="
      cn(
        'h-8 bg-zinc-500/20 rounded-lg outline outline-offset-[-1px] outline-node-component-border transition-all duration-150',
        'flex-1 flex px-2 items-center text-base leading-none cursor-text',
        searchQuery?.trim() !== '' ? 'text-base-foreground' : '',
        'hover:outline-component-node-widget-background-highlighted/80',
        'focus-within:outline-component-node-widget-background-highlighted/80'
      )
    "
  >
    <i
      v-if="isQuerying"
      class="mr-2 icon-[lucide--loader-circle] size-4 animate-spin"
    />
    <i v-else class="mr-2 icon-[lucide--search] size-4" />
    <input
      v-model="searchQuery"
      type="text"
      class="bg-transparent border-0 outline-0 ring-0 text-left"
      placeholder="Search"
    />
  </label>
</template>
