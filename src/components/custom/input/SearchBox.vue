<template>
  <div
    class="flex w-full items-center rounded-lg px-2 py-1.5 gap-2 bg-white dark-theme:bg-zinc-800"
  >
    <i-lucide:search class="text-neutral" />
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
import { defineModel } from 'vue'

const { placeHolder } = defineProps<{
  placeHolder?: string
}>()
const searchQuery = defineModel<string>('')
</script>
