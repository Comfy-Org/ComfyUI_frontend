<script setup lang="ts">
import type { PlaygroundExample } from '../../config/workshop-playground'
import { isVideoUrl } from '../../config/workshop-playground'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { examples, locale = 'en' } = defineProps<{
  examples: readonly PlaygroundExample[]
  locale?: Locale
}>()

const emit = defineEmits<{ open: [example: PlaygroundExample] }>()

const specsOf = (example: PlaygroundExample) => example.specs.join(' · ')
</script>

<template>
  <section class="flex flex-col gap-4" data-testid="examples-tab">
    <div class="flex flex-col gap-1">
      <h2 class="text-sm font-bold text-primary-warm-white">
        {{ t('workshop.examples.start', locale) }}
      </h2>
      <p class="text-sm text-primary-warm-gray">
        {{ t('workshop.examples.subtitle', locale) }}
      </p>
    </div>

    <p v-if="!examples.length" class="text-sm text-primary-warm-gray">
      {{ t('workshop.examples.empty', locale) }}
    </p>

    <ul v-else class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <li v-for="example in examples" :key="example.id">
        <button
          type="button"
          :aria-label="t('workshop.examples.open', locale)"
          class="group flex w-full cursor-pointer flex-col gap-2 text-left outline-none"
          data-testid="example-card"
          @click="emit('open', example)"
        >
          <span
            class="bg-primary-comfy-ink-light group-hover:ring-primary-comfy-yellow group-focus-visible:ring-primary-comfy-yellow relative block aspect-video overflow-hidden rounded-lg ring-0 transition-shadow group-hover:ring-2 group-focus-visible:ring-2"
          >
            <video
              v-if="isVideoUrl(example.outputUrl)"
              :src="example.outputUrl"
              class="size-full object-cover"
              muted
              loop
              playsinline
              autoplay
            />
            <img
              v-else-if="example.outputUrl"
              :src="example.outputUrl"
              :alt="example.title"
              class="size-full object-cover"
              loading="lazy"
              decoding="async"
            />
            <span
              class="absolute inset-0 grid place-items-center bg-primary-comfy-ink/70 px-2 text-center text-xs text-primary-warm-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
            >
              {{ t('workshop.examples.use', locale) }}
            </span>
          </span>

          <span class="flex flex-col gap-0.5">
            <span class="line-clamp-2 text-xs text-primary-comfy-canvas">
              {{ example.title }}
            </span>
            <span
              v-if="specsOf(example)"
              class="text-[11px] text-primary-warm-gray"
              data-testid="example-specs"
            >
              {{ specsOf(example) }}
            </span>
          </span>
        </button>
      </li>
    </ul>
  </section>
</template>
