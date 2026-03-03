<template>
  <template v-for="(label, index) in labels" :key="index">
    <i class="icon-[lucide--chevron-right] size-5 text-muted" />
    <a
      v-if="index < currentStep - 1"
      class="cursor-pointer text-muted transition-colors hover:text-foreground hover:underline"
      @click.prevent="emit('navigate', index + 1)"
    >
      {{ label }}
    </a>
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
