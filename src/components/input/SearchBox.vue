<template>
  <div :class="wrapperStyle">
    <i-lucide:search :class="iconColorStyle" />
    <InputText
      v-model="searchQuery"
      :placeholder="placeHolder || 'Search...'"
      type="text"
      unstyled
      class="w-full p-0 border-none outline-none bg-transparent text-xs text-neutral dark-theme:text-white"
    />
  </div>
</template>

<script setup lang="ts">
import InputText from 'primevue/inputtext'
import { computed } from 'vue'

const { placeHolder, hasBorder = false } = defineProps<{
  placeHolder?: string
  hasBorder?: boolean
}>()

const searchQuery = defineModel<string>({
  default: ''
})

const wrapperStyle = computed(() => {
  return hasBorder
    ? 'flex w-full items-center rounded gap-2 bg-white dark-theme:bg-zinc-800 p-1 border border-solid border-zinc-200 dark-theme:border-zinc-700'
    : 'flex w-full items-center rounded px-2 py-1.5 gap-2 bg-white dark-theme:bg-zinc-800'
})

const iconColorStyle = computed(() => {
  return !hasBorder ? 'text-neutral' : 'text-zinc-300 dark-theme:text-zinc-700'
})
</script>
