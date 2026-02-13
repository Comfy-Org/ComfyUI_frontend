<template>
  <div
    class="inline-flex items-center gap-1 rounded-lg bg-highlight px-2 py-1 -my-1"
  >
    <span class="text-sm opacity-80">{{ label }}:</span>
    <span v-if="typeColor" :style="{ color: typeColor }">&bull;</span>
    <span class="text-sm">{{ text }}</span>
    <button
      type="button"
      class="ml-1 cursor-pointer border-none bg-transparent text-muted-foreground hover:text-base-foreground rounded-full aspect-square"
      @click="$emit('remove', $event)"
    >
      <i class="pi pi-times text-xs" />
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  label: string
  text: string
  typeColor?: string
}>()

defineEmits<{
  remove: [event: Event]
}>()
</script>
