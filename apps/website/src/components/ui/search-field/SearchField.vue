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
    class="focus-within:ring-brand bg-hub-surface-hover flex h-12 w-full items-center gap-2 rounded-2xl px-4 transition-colors focus-within:ring-1"
    @submit.prevent
  >
    <Search class="text-hub-muted size-4 shrink-0" aria-hidden="true" />
    <input
      ref="searchInput"
      v-model="query"
      type="search"
      :aria-label="label"
      :placeholder="placeholder"
      class="text-content placeholder:text-hub-muted relative top-[0.09em] h-full min-w-0 flex-1 bg-transparent text-sm leading-none font-normal outline-none [&::-webkit-search-cancel-button]:hidden"
    />
    <kbd
      v-if="shortcut"
      aria-hidden="true"
      class="bg-hub-surface text-content/30 hidden size-6 shrink-0 items-center justify-center rounded-full font-mono text-xs leading-none lg:inline-flex"
    >
      /
    </kbd>
  </form>
  <p class="sr-only" aria-live="polite" role="status">{{ status }}</p>
</template>
