<script setup lang="ts">
import { refDebounced } from '@vueuse/core'
import { ref, toRef, toValue, watch } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import { cn } from '@/utils/tailwindUtil'

const { searcher = async () => {}, updateKey } = defineProps<{
  searcher?: (
    query: string,
    onCleanup: (cleanupFn: () => void) => void
  ) => Promise<void>
  updateKey?: MaybeRefOrGetter<unknown>
}>()

const searchQuery = defineModel<string>({ default: '' })

const isQuerying = ref(false)
const debouncedSearchQuery = refDebounced(searchQuery, 250, {
  maxWait: 1000
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

    void searcher(debouncedSearchQuery.value, (cb) => (cleanupFn = cb))
      .catch((error) => {
        console.error('[SidePanelSearch] searcher failed', error)
      })
      .finally(() => {
        if (!isCleanup) isQuerying.value = false
      })
  },
  { immediate: true }
)

function handleFocus(event: FocusEvent) {
  const target = event.target as HTMLInputElement
  target.select()
}
</script>

<template>
  <label
    :class="
      cn(
        'mt-1 not-disabled:bg-component-node-widget-background rounded-lg transition-all duration-150',
        'flex-1 flex items-center',
        'text-base-foreground border-0',
        'focus-within:ring focus-within:ring-component-node-widget-background-highlighted/80'
      )
    "
  >
    <i
      :class="
        cn(
          'size-4 text-muted-foreground ml-2',
          isQuerying
            ? 'icon-[lucide--loader-circle] animate-spin'
            : 'icon-[lucide--search]'
        )
      "
    />
    <input
      v-model="searchQuery"
      type="text"
      class="bg-transparent border-0 outline-0 ring-0 h-5 w-full my-1.5 mx-2"
      :placeholder="$t('g.searchPlaceholder')"
      @focus="handleFocus"
    />
    <button
      v-if="searchQuery.trim().length > 0"
      class="text-muted-foreground hover:text-base-foreground bg-transparent border-0 outline-0 ring-0 p-0 m-0 pr-3 pl-1 flex items-center justify-center transition-color duration-150"
      @click="searchQuery = ''"
    >
      <i :class="cn('icon-[lucide--delete] size-4 cursor-pointer')" />
    </button>
  </label>
</template>
