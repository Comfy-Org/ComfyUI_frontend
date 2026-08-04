<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { HTMLAttributes } from 'vue'

import type { Locale } from '../../i18n/translations'
import VideoPlayer from '../common/VideoPlayer.vue'
import Badge from '../ui/badge/Badge.vue'
import Button from '../ui/button/Button.vue'

type Cta = {
  label: string
  href: string
  target?: '_blank' | '_self' | '_parent' | '_top'
}

const {
  locale = 'en',
  eyebrow,
  title,
  body,
  primaryCta,
  secondaryCta,
  tags = [],
  videoSrc,
  videoPoster,
  class: className
} = defineProps<{
  locale?: Locale
  eyebrow: string
  title: string
  body: string
  primaryCta: Cta
  secondaryCta?: Cta
  tags?: string[]
  videoSrc: string
  videoPoster?: string
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <section
    :class="
      cn('max-w-9xl mx-auto w-full px-6 py-14 md:py-20 lg:px-12', className)
    "
  >
    <div
      class="bg-transparency-white-t4 lg:rounded-5xl flex flex-col gap-6 rounded-4xl p-2 lg:flex-row lg:gap-8"
    >
      <div class="relative aspect-video w-full lg:flex-1">
        <VideoPlayer
          :locale
          :src="videoSrc"
          :poster="videoPoster"
          autoplay
          lazy-autoplay
          loop
          mute-only
          class="lg:rounded-4.5xl absolute inset-0 aspect-auto h-full rounded-3xl border-0"
        />
      </div>

      <div
        class="flex w-full flex-col justify-center gap-2 p-4 lg:flex-1 lg:p-6"
      >
        <p
          class="text-primary-comfy-yellow text-sm font-bold tracking-[0.7px] uppercase"
        >
          {{ eyebrow }}
        </p>
        <h2
          class="text-3xl leading-[135%] font-medium text-primary-comfy-canvas"
        >
          {{ title }}
        </h2>
        <p
          class="max-w-160 text-[17px] leading-[160%] font-light text-primary-comfy-canvas"
        >
          {{ body }}
        </p>

        <div class="mt-12 flex flex-wrap gap-3 lg:gap-4">
          <Button :href="primaryCta.href" :target="primaryCta.target">
            {{ primaryCta.label }}
          </Button>
          <Button
            v-if="secondaryCta"
            variant="outline"
            :href="secondaryCta.href"
            :target="secondaryCta.target"
          >
            {{ secondaryCta.label }}
          </Button>
        </div>

        <div v-if="tags.length" class="mt-14 flex flex-wrap gap-2">
          <Badge
            v-for="tag in tags"
            :key="tag"
            variant="subtle"
            size="md"
            class="py-2 text-primary-comfy-canvas"
          >
            {{ tag }}
          </Badge>
        </div>
      </div>
    </div>
  </section>
</template>
