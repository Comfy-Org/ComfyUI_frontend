<template>
  <div :class="cn('h-full p-8', props.class)">
    <div class="bg-(--surface-ground) text-center">
      <div class="flex flex-col items-center">
        <i v-if="icon" :class="cn(icon, 'mb-4 text-5xl')" />
        <h3 v-if="title" class="mb-2 text-base-foreground">{{ title }}</h3>
        <p :class="cn('mb-4 text-center whitespace-pre-line', textClass)">
          {{ message }}
        </p>
        <Button
          v-if="buttonLabel"
          :variant="buttonVariant ?? 'textonly'"
          @click="$emit('action')"
        >
          <i v-if="buttonIcon" :class="buttonIcon" />
          {{ buttonLabel }}
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import Button from '@/components/ui/button/Button.vue'
import type { ButtonVariants } from '../ui/button/button.variants'

const props = defineProps<{
  class?: string
  icon?: string
  title?: string
  message: string
  textClass?: string
  buttonIcon?: string
  buttonLabel?: string
  buttonVariant?: ButtonVariants['variant']
}>()

defineEmits(['action'])
</script>
