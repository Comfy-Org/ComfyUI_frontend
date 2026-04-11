<script setup lang="ts">
const {
  href,
  label,
  variant = 'solid',
  className = ''
} = defineProps<{
  href: string
  label: string
  variant?: 'solid' | 'outline'
  className?: string
}>()
</script>

<template>
  <a
    :href="href"
    class="rounded-2xl px-4 py-2 text-sm font-semibold"
    :class="[
      className,
      variant === 'solid'
        ? 'bg-primary-comfy-yellow text-primary-comfy-ink transition-opacity hover:opacity-90'
        : 'border-primary-comfy-yellow text-primary-comfy-yellow hover:bg-primary-comfy-yellow hover:text-primary-comfy-ink border transition-colors'
    ]"
  >
    {{ label }}
  </a>
</template>
