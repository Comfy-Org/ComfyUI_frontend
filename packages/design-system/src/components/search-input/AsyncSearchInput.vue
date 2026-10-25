<script setup lang="ts">
import { refDebounced } from '@vueuse/core'
import { nextTick, onMounted, ref, toRef, toValue, watch } from 'vue'
import type { HTMLAttributes, MaybeRefOrGetter } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

const {
  accessibleLabel,
  clearLabel,
  placeholder,
  searcher = async () => {},
  updateKey,
  autofocus = false,
  debounceMs = 250,
  debounceMaxWaitMs = 1000,
  class: customClass
} = defineProps<{
  accessibleLabel: string
  clearLabel: string
  placeholder?: string
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

const inputRef = ref<HTMLInputElement>()
onMounted(() => {
  if (!autofocus) return
  void nextTick(() => inputRef.value?.focus())
})

defineExpose({
  focus: () => inputRef.value?.focus()
})

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
        'rounded-lg bg-secondary transition-all duration-150',
        'flex flex-1 items-center',
        'border-0 text-foreground',
        'focus-within:ring focus-within:ring-ring',
        customClass
      )
    "
  >
    <i
      :class="
        cn(
          'ml-2 shrink-0 transition-colors duration-150',
          isQuerying
            ? 'icon-[lucide--loader-circle] animate-spin'
            : 'icon-[lucide--search]',
          searchQuery?.trim() !== ''
            ? 'text-foreground'
            : 'text-muted-foreground group-focus-within:text-foreground group-hover:text-foreground'
        )
      "
    />
    <input
      ref="inputRef"
      v-model="searchQuery"
      type="text"
      class="mx-2 my-1.5 h-5 w-full min-w-0 border-0 bg-transparent text-sm ring-0 outline-0"
      :placeholder
      :aria-label="accessibleLabel"
      :autofocus
      @focus="handleFocus"
      @keydown.enter="handleKeydownEnter"
    />
    <button
      v-if="searchQuery.trim().length > 0"
      class="m-0 flex shrink-0 items-center justify-center border-0 bg-transparent p-0 pr-3 pl-1 text-muted-foreground ring-0 outline-0 transition-all duration-150 hover:scale-108 hover:text-foreground"
      :aria-label="clearLabel"
      @click="searchQuery = ''"
    >
      <i :class="cn('icon-[lucide--delete] cursor-pointer')" />
    </button>
  </label>
</template>
