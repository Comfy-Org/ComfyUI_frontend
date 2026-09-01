<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import type { AnchorHTMLAttributes, HTMLAttributes } from 'vue'

import GlassCard from '../common/GlassCard.vue'
import Button from '../ui/button/Button.vue'
import { resolveRel } from '../../utils/cta'

type Cta = {
  label: string
  href: string
  target?: AnchorHTMLAttributes['target']
}

type Band = {
  id: string
  label: string
  text: string
  cta: Cta
}

const { bands, class: className } = defineProps<{
  bands: readonly Band[]
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <section :class="cn('max-w-9xl mx-auto px-6 py-16 lg:py-24', className)">
    <GlassCard class="flex flex-col gap-2">
      <div
        v-for="band in bands"
        :key="band.id"
        class="flex flex-col gap-6 rounded-4xl bg-primary-comfy-ink p-8 lg:flex-row lg:items-center lg:gap-8 lg:px-12 lg:py-10"
      >
        <h2
          class="text-primary-comfy-yellow shrink-0 text-2xl font-normal tracking-wide uppercase lg:w-72 lg:text-[1.625rem]"
        >
          {{ band.label }}
        </h2>
        <p
          class="max-w-xl flex-1 text-base/relaxed font-light text-primary-comfy-canvas"
        >
          {{ band.text }}
        </p>
        <Button
          as="a"
          :href="band.cta.href"
          :target="band.cta.target"
          :rel="resolveRel(band.cta)"
          variant="outline"
          size="lg"
          class="h-12 text-sm lg:min-w-100"
        >
          {{ band.cta.label }}
        </Button>
      </div>
    </GlassCard>
  </section>
</template>
