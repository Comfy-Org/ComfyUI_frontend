<script setup lang="ts">
import { useId } from 'vue'

const { label, placeholder } = defineProps<{
  label: string
  placeholder?: string
}>()
const value = defineModel<string>({ required: true })
const id = useId()
</script>

<template>
  <div class="flex flex-col gap-2 px-1">
    <label :for="id" data-field-label class="text-xs text-primary-warm-gray">{{
      label
    }}</label>
    <textarea
      :id
      v-model="value"
      rows="3"
      :placeholder
      class="resize-none rounded-lg bg-transparency-white-t4 px-2.5 py-2 text-xs text-primary-warm-white placeholder:text-primary-warm-gray/60 focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none disabled:opacity-40"
    />
  </div>
</template>
