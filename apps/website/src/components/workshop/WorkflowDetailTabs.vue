<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

const section = defineModel<string>({ required: true })
</script>

<template>
  <div
    class="mb-6 flex gap-7 border-b border-transparency-white-t8"
    aria-label="Workflow sections"
  >
    <button
      v-for="item in ['playground', 'workflow', 'api']"
      :key="item"
      type="button"
      :aria-pressed="section === item"
      :class="
        cn(
          'min-h-12 border-b-2 px-1 text-sm font-medium uppercase transition-colors hover:text-primary-comfy-yellow',
          section === item
            ? 'border-primary-comfy-yellow text-primary-comfy-canvas'
            : 'border-transparent text-primary-warm-gray'
        )
      "
      @click="section = item"
    >
      {{ item }}
    </button>
  </div>
</template>
