<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import SectionHeader from '../../common/SectionHeader.vue'

defineProps<{
  heading: string
  subtitle?: string
  columns?: 2 | 3
}>()
</script>

<template>
  <section class="px-4 py-24 lg:px-20">
    <SectionHeader>
      {{ heading }}
      <template v-if="subtitle" #subtitle>
        <p class="mt-4 text-sm text-smoke-700 lg:text-base">
          {{ subtitle }}
        </p>
      </template>
    </SectionHeader>

    <div
      :class="
        cn(
          'mt-12 grid gap-6 lg:mt-16',
          columns === 2 ? 'lg:grid-cols-2' : 'lg:grid-cols-3'
        )
      "
    >
      <slot />
    </div>

    <slot name="footer" />
  </section>
</template>
