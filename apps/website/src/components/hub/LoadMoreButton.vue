<script setup lang="ts">
const { label, disabled = false } = defineProps<{
  label: string
  disabled?: boolean
}>()
const emit = defineEmits<{ click: [] }>()
</script>

<template>
  <div class="flex justify-center pt-10 pb-4">
    <button
      type="button"
      :disabled
      data-testid="hub-load-more"
      class="inline-flex h-10 cursor-pointer items-center justify-center rounded-2xl border border-brand px-12 text-sm font-semibold tracking-wider text-brand uppercase transition-colors hover:bg-brand hover:text-page disabled:cursor-wait disabled:opacity-50"
      @click="emit('click')"
    >
      {{ label }}
    </button>
  </div>
</template>
