<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import Button from '../ui/button/Button.vue'

const { title, description, cta, href, bg } = defineProps<{
  title: string
  description: string
  cta: string
  href: string
  bg: string
}>()
</script>

<template>
  <a
    :href="href"
    :class="
      cn(
        'rounded-4.5xl flex flex-col justify-between p-8 transition-opacity hover:opacity-90',
        bg
      )
    "
  >
    <h3 class="text-3xl font-light whitespace-pre-line text-white lg:text-4xl">
      {{ title }}
    </h3>

    <div class="mt-auto pt-16">
      <p class="text-sm text-white/70">
        {{ description }}
      </p>
      <Button
        as="span"
        variant="default"
        size="sm"
        class="mt-4 h-auto whitespace-normal"
      >
        {{ cta }}
      </Button>
    </div>
  </a>
</template>
