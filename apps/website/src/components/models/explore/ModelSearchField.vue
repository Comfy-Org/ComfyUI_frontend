<script setup lang="ts">
import { Search } from '@lucide/vue'
import { onBeforeUnmount, onMounted, useTemplateRef } from 'vue'

const {
  label,
  placeholder,
  shortcut = true,
  status = ''
} = defineProps<{
  label: string
  placeholder: string
  shortcut?: boolean
  status?: string
}>()

const query = defineModel<string>({ default: '' })
const searchInput = useTemplateRef<HTMLInputElement>('searchInput')

function isEditableTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName))
  )
}

function handleShortcut(event: KeyboardEvent) {
  if (
    event.key !== '/' ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey ||
    isEditableTarget(event.target)
  )
    return

  event.preventDefault()
  searchInput.value?.focus()
}

onMounted(() => window.addEventListener('keydown', handleShortcut))
onBeforeUnmount(() => window.removeEventListener('keydown', handleShortcut))
</script>

<template>
  <form
    role="search"
    class="flex h-12 w-full items-center gap-2 rounded-2xl bg-hub-surface-hover px-4 transition-colors focus-within:ring-1 focus-within:ring-brand"
    @submit.prevent
  >
    <Search class="size-4 shrink-0 text-hub-muted" aria-hidden="true" />
    <input
      ref="searchInput"
      v-model="query"
      type="search"
      :aria-label="label"
      :placeholder="placeholder"
      class="relative top-[0.09em] h-full min-w-0 flex-1 bg-transparent text-sm leading-none font-normal text-content outline-none placeholder:text-hub-muted [&::-webkit-search-cancel-button]:hidden"
    />
    <kbd
      v-if="shortcut"
      aria-hidden="true"
      class="hidden size-6 shrink-0 items-center justify-center rounded-full bg-hub-surface font-mono text-xs leading-none text-content/30 lg:inline-flex"
    >
      /
    </kbd>
  </form>
  <p class="sr-only" aria-live="polite" role="status">{{ status }}</p>
</template>
