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

const {
  bands,
  variant = 'default',
  class: className
} = defineProps<{
  bands: readonly Band[]
  variant?: 'default' | 'highlight'
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
        <template v-if="variant === 'highlight'">
          <div class="flex flex-1 flex-col gap-3">
            <h2
              class="text-2xl font-normal text-primary-warm-white lg:text-3xl"
            >
              {{ band.label }}
            </h2>
            <p
              class="max-w-4xl text-base/relaxed font-light text-primary-comfy-canvas"
            >
              {{ band.text }}
            </p>
          </div>
          <Button
            as="a"
            :href="band.cta.href"
            :target="band.cta.target"
            :rel="resolveRel(band.cta)"
            variant="outline"
            size="lg"
            class="h-12 shrink-0 self-start rounded-full text-sm lg:self-center"
          >
            {{ band.cta.label }}
          </Button>
        </template>
        <template v-else>
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
        </template>
      </div>
    </GlassCard>
  </section>
</template>
