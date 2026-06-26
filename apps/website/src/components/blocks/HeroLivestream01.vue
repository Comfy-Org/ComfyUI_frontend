<script setup lang="ts">
import type { AnchorHTMLAttributes } from 'vue'
import { computed, onMounted, ref } from 'vue'
import { useNow } from '@vueuse/core'

import Button from '../ui/button/Button.vue'
import { resolveRel } from '../../utils/cta'

type Cta = {
  label: string
  href: string
  target?: AnchorHTMLAttributes['target']
  rel?: AnchorHTMLAttributes['rel']
}

type Visual =
  | {
      type: 'image'
      src: string
      alt: string
      width?: number
      height?: number
    }
  | {
      type: 'video'
      src: string
      alt: string
      poster?: string
      width?: number
      height?: number
    }

const {
  visual,
  eyebrow,
  title,
  subtitle,
  primaryCta,
  secondaryCta,
  youtubeVideoId,
  startDateTime,
  endDateTime
} = defineProps<{
  visual?: Visual
  eyebrow?: string
  title: string
  subtitle?: string
  primaryCta: Cta
  secondaryCta?: Cta
  youtubeVideoId: string
  startDateTime: string
  endDateTime: string
}>()

const embedUrl = computed(
  () =>
    `https://www.youtube-nocookie.com/embed/${youtubeVideoId}?autoplay=1&mute=1&rel=0`
)

// Keep SSR/initial paint deterministic on the logo and only flip to the embed
// after client hydration — avoids a build-time `now` leaking into the markup.
const mounted = ref(false)
onMounted(() => {
  mounted.value = true
})

const now = useNow({ interval: 30_000 })
const startMs = computed(() => new Date(startDateTime).getTime())
const endMs = computed(() => new Date(endDateTime).getTime())

const isLive = computed(
  () =>
    mounted.value &&
    now.value.getTime() >= startMs.value &&
    now.value.getTime() < endMs.value
)
</script>

<template>
  <section
    class="max-w-9xl mx-auto flex flex-col items-center px-6 py-16 text-center lg:py-24"
  >
    <div
      v-if="isLive"
      class="mb-10 aspect-video w-full overflow-hidden rounded-2xl lg:mb-12"
    >
      <iframe
        :src="embedUrl"
        :title="title"
        class="size-full"
        loading="lazy"
        allow="autoplay; encrypted-media; picture-in-picture"
        allowfullscreen
      />
    </div>
    <slot v-else name="visual">
      <img
        v-if="visual?.type === 'image'"
        :src="visual.src"
        :alt="visual.alt"
        :width="visual.width"
        :height="visual.height"
        fetchpriority="high"
        decoding="async"
        class="mb-10 h-auto w-full max-w-md lg:mb-12 lg:max-w-lg"
      />
      <video
        v-else-if="visual?.type === 'video'"
        :src="visual.src"
        :poster="visual.poster"
        :aria-label="visual.alt"
        :width="visual.width"
        :height="visual.height"
        autoplay
        loop
        muted
        playsinline
        preload="metadata"
        class="mb-10 h-auto w-full max-w-md lg:mb-12 lg:max-w-2xl"
      />
    </slot>

    <p
      v-if="eyebrow"
      class="mb-4 text-sm font-medium tracking-wide text-primary-comfy-canvas/70 uppercase"
    >
      {{ eyebrow }}
    </p>

    <h1
      class="max-w-3xl text-4xl/snug font-light tracking-tight text-pretty text-primary-comfy-canvas lg:text-6xl/snug"
    >
      {{ title }}
    </h1>

    <p
      v-if="subtitle"
      class="mt-6 max-w-2xl text-base text-primary-comfy-canvas/70 lg:text-lg"
    >
      {{ subtitle }}
    </p>

    <div class="mt-10 flex flex-col gap-4 sm:flex-row lg:mt-12">
      <Button
        as="a"
        :href="primaryCta.href"
        :target="primaryCta.target"
        :rel="resolveRel(primaryCta)"
        size="lg"
      >
        {{ primaryCta.label }}
      </Button>
      <Button
        v-if="secondaryCta"
        as="a"
        :href="secondaryCta.href"
        :target="secondaryCta.target"
        :rel="resolveRel(secondaryCta)"
        variant="outline"
        size="lg"
      >
        {{ secondaryCta.label }}
      </Button>
    </div>
  </section>
</template>
