<script setup lang="ts">
import { Check } from '@lucide/vue'
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { PlaygroundExample } from '@/config/workshop-playground'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import ExampleMedia from './ExampleMedia.vue'

const { example, locale = 'en' } = defineProps<{
  example: PlaygroundExample
  active: boolean
  alt: string
  videoPreload: 'metadata' | 'none'
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const emit = defineEmits<{ open: [] }>()

const specs = computed(() => example.specs.join(' · '))

function actionFor(active = false) {
  if (example.sampleOnly)
    return t(active ? 'workshop.examples.viewing' : 'workshop.examples.view')
  return t(active ? 'workshop.examples.using' : 'workshop.examples.use')
}

const openLabel = computed(() =>
  example.sampleOnly ? actionFor() : t('workshop.examples.open')
)
</script>

<template>
  <figure class="flex flex-col gap-2">
    <button
      type="button"
      :aria-label="`${example.title}: ${openLabel}`"
      :aria-current="active ? 'true' : undefined"
      class="group flex w-full cursor-pointer flex-col gap-2 text-left outline-none"
      data-testid="example-card"
      :title="`${example.title} · ${actionFor(active)}`"
      @click="emit('open')"
    >
      <span
        :class="
          cn(
            'relative block aspect-video overflow-hidden rounded-lg bg-primary-comfy-ink-light ring-1 transition-all',
            active
              ? 'ring-2 ring-primary-comfy-yellow'
              : 'ring-transparency-white-t8 group-hover:-translate-y-0.5 group-hover:ring-transparency-white-t20 group-hover:brightness-110 group-focus-visible:ring-primary-comfy-yellow'
          )
        "
      >
        <ExampleMedia :example :alt :video-preload />

        <span
          v-if="active"
          class="absolute top-1.5 right-1.5 grid size-5 place-items-center rounded-full bg-primary-comfy-yellow text-primary-comfy-ink"
          data-testid="example-chosen"
        >
          <Check class="size-3" :stroke-width="3" aria-hidden="true" />
        </span>
        <span
          v-else
          class="absolute top-1.5 left-1.5 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-medium text-primary-warm-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
          aria-hidden="true"
        >
          {{ actionFor() }}
        </span>

        <span
          class="absolute inset-x-0 bottom-0 flex flex-col gap-0.5 bg-linear-to-t from-black/85 to-transparent px-2 pt-6 pb-1.5"
        >
          <span class="line-clamp-1 text-xs text-primary-warm-white">
            {{ example.title }}
          </span>
          <span
            v-if="specs"
            class="line-clamp-1 text-[11px] text-primary-comfy-canvas/70"
            data-testid="example-specs"
          >
            {{ specs }}
          </span>
        </span>
      </span>
    </button>
    <audio
      v-if="example.mediaKind === 'audio'"
      :src="example.outputUrl"
      :aria-label="alt"
      controls
      preload="metadata"
      class="w-full"
    />
  </figure>
</template>
