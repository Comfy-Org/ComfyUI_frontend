<script setup lang="ts">
import type { PlaygroundExample } from '../../config/workshop-playground'
import { isVideoUrl } from '../../config/workshop-playground'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const {
  examples,
  modelName,
  credits,
  locale = 'en'
} = defineProps<{
  examples: readonly PlaygroundExample[]
  modelName: string
  credits?: number
  locale?: Locale
}>()

const emit = defineEmits<{ open: [example: PlaygroundExample] }>()

const specsOf = (example: PlaygroundExample) =>
  [
    ...example.specs,
    ...(credits === undefined ? [] : [`${credits} ${t('nav.credits', locale)}`])
  ].join(' · ')
</script>

<template>
  <section class="flex flex-col gap-6" data-testid="examples-tab">
    <div class="flex flex-col gap-2">
      <h2
        class="text-xs font-bold tracking-wider text-primary-warm-gray uppercase"
      >
        {{
          t('workshop.examples.madeWith', locale).replace('{model}', modelName)
        }}
      </h2>
      <p class="text-sm text-primary-comfy-canvas">
        {{ t('workshop.examples.subtitle', locale) }}
      </p>
    </div>

    <p v-if="!examples.length" class="text-sm text-primary-warm-gray">
      {{ t('workshop.examples.empty', locale) }}
    </p>

    <ul v-else class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      <li v-for="example in examples" :key="example.id">
        <button
          type="button"
          :aria-label="t('workshop.examples.open', locale)"
          class="bg-transparency-white-t4 focus-visible:ring-primary-comfy-yellow/50 group flex w-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-transparency-white-t8 text-left transition-colors outline-none hover:border-transparency-white-t20 focus-visible:ring-3"
          data-testid="example-card"
          @click="emit('open', example)"
        >
          <div class="bg-primary-comfy-ink-light aspect-video overflow-hidden">
            <video
              v-if="isVideoUrl(example.outputUrl)"
              :src="example.outputUrl"
              class="size-full object-cover transition-transform duration-300 group-hover:scale-105"
              muted
              loop
              playsinline
              autoplay
            />
            <img
              v-else-if="example.outputUrl"
              :src="example.outputUrl"
              :alt="example.title"
              class="size-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
              decoding="async"
            />
          </div>
          <div class="flex flex-col gap-1 px-4 py-3">
            <p class="line-clamp-2 text-sm text-primary-warm-white">
              {{ example.prompt ? `"${example.prompt}"` : example.title }}
            </p>
            <p
              v-if="specsOf(example)"
              class="text-xs text-primary-warm-gray"
              data-testid="example-specs"
            >
              {{ specsOf(example) }}
            </p>
          </div>
        </button>
      </li>
    </ul>
  </section>
</template>
