<template>
  <template v-for="(label, index) in labels" :key="index">
    <i class="icon-[lucide--chevron-right] size-5 text-muted" />
    <button
      v-if="index < currentStep - 1"
      class="cursor-pointer border-none bg-transparent p-0 text-muted transition-colors [font:inherit] hover:text-foreground hover:underline focus-visible:text-foreground focus-visible:underline focus-visible:outline-none"
      @click="emit('navigate', index + 1)"
    >
      {{ label }}
    </button>
    <span
      v-else
      :class="index === currentStep - 1 ? 'font-medium' : 'text-muted'"
    >
      {{ label }}
    </span>
  </template>
</template>

<script setup lang="ts">
defineProps<{
  labels: string[]
  currentStep: number
}>()

const emit = defineEmits<{
  navigate: [step: number]
}>()
</script>
