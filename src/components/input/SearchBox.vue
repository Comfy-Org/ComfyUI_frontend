<template>
  <div :class="wrapperStyle" @click="focusInput">
    <i-lucide:search :class="iconColorStyle" />
    <InputText
      ref="input"
      v-model="searchQuery"
      :placeholder="placeHolder || 'Search...'"
      type="text"
      unstyled
      class="w-full p-0 border-none outline-hidden bg-transparent text-xs text-neutral dark-theme:text-white"
    />
  </div>
</template>

<script setup lang="ts">
import InputText from 'primevue/inputtext'
import { computed, ref } from 'vue'

const { placeHolder, showBorder = false } = defineProps<{
  placeHolder?: string
  showBorder?: boolean
}>()
// defineModel without arguments uses 'modelValue' as the prop name
const searchQuery = defineModel<string>()

const input = ref<{ $el: HTMLElement } | null>()
const focusInput = () => {
  if (input.value && input.value.$el) {
    input.value.$el.focus()
  }
}

const wrapperStyle = computed(() => {
  const baseStyles = showBorder
    ? 'flex w-full items-center rounded gap-2 bg-white dark-theme:bg-zinc-800 p-1 border border-solid border-zinc-200 dark-theme:border-zinc-700'
    : 'flex w-full items-center rounded px-2 py-1.5 gap-2 bg-white dark-theme:bg-zinc-800'

  return `${baseStyles} cursor-text`
})

const iconColorStyle = computed(() => {
  return !showBorder ? 'text-neutral' : 'text-zinc-300 dark-theme:text-zinc-700'
})
</script>
