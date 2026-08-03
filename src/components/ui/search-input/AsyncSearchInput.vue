<script setup lang="ts">
import { refDebounced } from '@vueuse/core'
import { ref, toRef, toValue, watch } from 'vue'
import type { HTMLAttributes, MaybeRefOrGetter } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

const {
  searcher = async () => {},
  updateKey,
  autofocus = false,
  debounceMs = 250,
  debounceMaxWaitMs = 1000,
  class: customClass
} = defineProps<{
  searcher?: (
    query: string,
    onCleanup: (cleanupFn: () => void) => void
  ) => Promise<void>
  updateKey?: MaybeRefOrGetter<unknown>
  autofocus?: boolean
  debounceMs?: number
  debounceMaxWaitMs?: number
  class?: HTMLAttributes['class']
}>()
const emit = defineEmits<{
  enter: [event: KeyboardEvent]
}>()

const searchQuery = defineModel<string>({ default: '' })

const isQuerying = ref(false)
const debouncedSearchQuery = refDebounced(searchQuery, debounceMs, {
  maxWait: debounceMaxWaitMs
})
watch(searchQuery, (value) => {
  isQuerying.value = value !== debouncedSearchQuery.value
})
const updateKeyRef = toRef(() => toValue(updateKey))

watch(
  [debouncedSearchQuery, updateKeyRef],
  (_, __, onCleanup) => {
    let isCleanup = false
    let cleanupFn: undefined | (() => void)
    onCleanup(() => {
      isCleanup = true
      cleanupFn?.()
    })

    searcher(debouncedSearchQuery.value, (cb) => (cleanupFn = cb))
      .catch((error) => {
        console.error('[AsyncSearchInput] searcher failed', error)
      })
      .finally(() => {
        if (!isCleanup) isQuerying.value = false
      })
  },
  { immediate: true }
)

function handleFocus(event: FocusEvent) {
  const target = event.target
  if (target instanceof HTMLInputElement) {
    target.select()
  }
}

function handleKeydownEnter(event: KeyboardEvent) {
  if (event.isComposing) return
  emit('enter', event)
}
</script>

<template>
  <label
    :class="
      cn(
        'group',
        'rounded-lg bg-component-node-widget-background transition-all duration-150',
        'flex flex-1 items-center',
        'border-0 text-base-foreground',
        'focus-within:ring focus-within:ring-component-node-widget-background-highlighted/80',
        customClass
      )
    "
  >
    <i
      :class="
        cn(
          'ml-2 size-4 shrink-0 transition-colors duration-150',
          isQuerying
            ? 'icon-[lucide--loader-circle] animate-spin'
            : 'icon-[lucide--search]',
          searchQuery?.trim() !== ''
            ? 'text-base-foreground'
            : 'text-muted-foreground group-focus-within:text-base-foreground group-hover:text-base-foreground'
        )
      "
    />
    <input
      v-model="searchQuery"
      type="text"
      class="mx-2 my-1.5 h-5 w-full min-w-0 border-0 bg-transparent ring-0 outline-0"
      :placeholder="$t('g.searchPlaceholder', { subject: '' })"
      :autofocus
      @focus="handleFocus"
      @keydown.enter="handleKeydownEnter"
    />
    <button
      v-if="searchQuery.trim().length > 0"
      class="m-0 flex shrink-0 items-center justify-center border-0 bg-transparent p-0 pr-3 pl-1 text-muted-foreground ring-0 outline-0 transition-all duration-150 hover:scale-108 hover:text-base-foreground"
      :aria-label="$t('g.clear')"
      @click="searchQuery = ''"
    >
      <i :class="cn('icon-[lucide--delete] size-4 cursor-pointer')" />
    </button>
  </label>
</template>
