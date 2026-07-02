<script setup lang="ts">
import type { HTMLAttributes } from 'vue'

const {
  as = 'span',
  duration = 2,
  spread = 2,
  class: className
} = defineProps<{
  as?: keyof HTMLElementTagNameMap
  class?: HTMLAttributes['class']
  duration?: number
  spread?: number
}>()
</script>

<template>
  <component
    :is="as"
    :class="['shimmer', className]"
    :style="{
      '--shimmer-duration': `${duration}s`,
      '--shimmer-spread': `${(($slots.default?.()[0]?.children as string)?.length ?? 10) * spread}px`
    }"
  >
    <slot />
  </component>
</template>

<style scoped>
.shimmer {
  background-image:
    linear-gradient(
      90deg,
      transparent calc(50% - var(--shimmer-spread)),
      var(--color-base-foreground),
      transparent calc(50% + var(--shimmer-spread))
    ),
    linear-gradient(
      var(--color-muted-foreground),
      var(--color-muted-foreground)
    );
  background-size:
    250% 100%,
    auto;
  background-repeat: no-repeat;
  background-clip: text;
  color: transparent;
  animation: shimmer-sweep var(--shimmer-duration) linear infinite;
}
</style>
