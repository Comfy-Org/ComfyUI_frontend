<template>
  <div
    :class="buttonClasses"
    :style="buttonStyles"
    class="experimental-run-button relative overflow-hidden transition-all duration-300"
    @click="handleClick"
  >
    <!-- Animated background for gradient variant -->
    <div
      v-if="variantName === 'bold-gradient'"
      class="absolute inset-0 animate-gradient bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 opacity-90"
    />

    <!-- Pulsing animation for animated variant -->
    <div
      v-if="variantName === 'animated'"
      class="absolute inset-0 animate-pulse bg-primary-background opacity-20"
    />

    <!-- Sparkle effect for playful variant -->
    <div
      v-if="variantName === 'playful'"
      class="absolute inset-0 overflow-hidden"
    >
      <i
        v-for="i in 3"
        :key="i"
        :class="sparkleClasses[i - 1]"
        class="absolute animate-sparkle text-yellow-300"
        :style="sparkleStyles[i - 1]"
      >
        ✨
      </i>
    </div>

    <!-- Button content -->
    <div class="relative z-10 flex items-center justify-center gap-2">
      <i :class="iconClass" class="text-lg" />
      <span :class="labelClasses" :style="labelStyles" class="font-semibold">
        {{ label }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import type { FeatureFlagVariant } from '@/composables/useFeatureFlags'

const props = defineProps<{
  variant: FeatureFlagVariant
  onClick: () => void
}>()

const variantName = computed(() => props.variant.variant)
const payload = computed(() => props.variant.payload || {})

// Extract styling from payload with defaults
const backgroundColor = computed(
  () => (payload.value.backgroundColor as string) || getDefaultColor()
)
const textColor = computed(
  () => (payload.value.textColor as string) || getDefaultTextColor()
)
const borderRadius = computed(
  () => (payload.value.borderRadius as string) || getDefaultBorderRadius()
)
const icon = computed(() => (payload.value.icon as string) || getDefaultIcon())
const label = computed(() => (payload.value.label as string) || 'Run')
const padding = computed(() => (payload.value.padding as string) || 'px-4 py-2')

// Size matching - should match PrimeVue small button size
const buttonSize = computed(() => {
  return 'text-sm' // Match PrimeVue small button
})

function getDefaultColor(): string {
  switch (variantName.value) {
    case 'bold-gradient':
      return 'transparent' // Gradient overlay handles it
    case 'animated':
      return 'bg-primary-background'
    case 'playful':
      return 'bg-gradient-to-br from-yellow-400 to-orange-500'
    case 'minimal':
      return 'bg-white border-2 border-gray-300'
    default:
      return 'bg-primary-background'
  }
}

function getDefaultTextColor(): string {
  switch (variantName.value) {
    case 'bold-gradient':
      return 'text-white'
    case 'animated':
      return 'text-white'
    case 'playful':
      return 'text-white'
    case 'minimal':
      return 'text-gray-800'
    default:
      return 'text-white'
  }
}

function getDefaultBorderRadius(): string {
  switch (variantName.value) {
    case 'bold-gradient':
      return 'rounded-xl'
    case 'animated':
      return 'rounded-full'
    case 'playful':
      return 'rounded-2xl'
    case 'minimal':
      return 'rounded-md'
    default:
      return 'rounded-lg'
  }
}

function getDefaultIcon(): string {
  switch (variantName.value) {
    case 'bold-gradient':
      return 'icon-[lucide--zap]'
    case 'animated':
      return 'icon-[lucide--rocket]'
    case 'playful':
      return 'icon-[lucide--sparkles]'
    case 'minimal':
      return 'icon-[lucide--play]'
    default:
      return 'icon-[lucide--play]'
  }
}

const buttonClasses = computed(() => {
  const base = [
    'cursor-pointer',
    'select-none',
    'flex',
    'items-center',
    'justify-center',
    padding.value,
    borderRadius.value,
    'shadow-lg',
    'hover:scale-105',
    'active:scale-95',
    'transition-transform',
    buttonSize.value
  ]

  // Add variant-specific classes
  if (variantName.value === 'bold-gradient') {
    base.push('text-white', 'font-bold')
  } else if (variantName.value === 'animated') {
    base.push('text-white', 'font-bold', 'hover:shadow-2xl')
  } else if (variantName.value === 'playful') {
    base.push('text-white', 'font-bold', 'hover:rotate-1')
  } else if (variantName.value === 'minimal') {
    base.push('bg-white', 'text-gray-800', 'hover:bg-gray-50')
  } else {
    base.push(backgroundColor.value, textColor.value)
  }

  return base.join(' ')
})

const buttonStyles = computed(() => {
  const styles: Record<string, string> = {}

  // Apply custom styles from payload
  if (payload.value.backgroundColor && variantName.value !== 'bold-gradient') {
    styles.backgroundColor = backgroundColor.value
  }
  if (payload.value.textColor) {
    styles.color = textColor.value
  }
  if (payload.value.borderRadius && !borderRadius.value.includes('rounded')) {
    styles.borderRadius = borderRadius.value
  }

  return styles
})

const iconClass = computed(() => icon.value)

// Text color handling - can be a CSS class or a color value
const labelClasses = computed(() => {
  // If textColor is a Tailwind class, return it; otherwise it's handled by inline styles
  if (textColor.value.startsWith('text-')) {
    return textColor.value
  }
  return ''
})

const labelStyles = computed(() => {
  const styles: Record<string, string> = {}
  // If textColor is not a Tailwind class, use it as a color value
  if (!textColor.value.startsWith('text-')) {
    styles.color = textColor.value
  }
  return styles
})

// Sparkle animation positions for playful variant
const sparkleClasses = ['top-2 left-4', 'top-4 right-6', 'bottom-2 left-1/2']

const sparkleStyles = [
  { animationDelay: '0s', animationDuration: '2s' },
  { animationDelay: '0.5s', animationDuration: '2.5s' },
  { animationDelay: '1s', animationDuration: '3s' }
]

function handleClick() {
  props.onClick()
}
</script>

<style scoped>
@keyframes gradient {
  0%,
  100% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
}

.animate-gradient {
  background-size: 200% 200%;
  animation: gradient 3s ease infinite;
}

@keyframes sparkle {
  0%,
  100% {
    opacity: 0;
    transform: scale(0) rotate(0deg);
  }
  50% {
    opacity: 1;
    transform: scale(1) rotate(180deg);
  }
}

.animate-sparkle {
  animation: sparkle 2s ease-in-out infinite;
}
</style>
