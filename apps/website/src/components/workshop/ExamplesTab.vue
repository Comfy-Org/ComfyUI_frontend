<script setup lang="ts">
import { ArrowRight } from '@lucide/vue'

import Button from '@/components/ui/button/Button.vue'
import type { PlaygroundExample } from '../../config/workshop-playground'
import { isVideoUrl } from '../../config/workshop-playground'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { examples, locale = 'en' } = defineProps<{
  examples: readonly PlaygroundExample[]
  locale?: Locale
}>()

const emit = defineEmits<{ open: [example: PlaygroundExample] }>()
</script>

<template>
  <section class="flex flex-col gap-6" data-testid="examples-tab">
    <h2 class="text-2xl font-bold text-primary-comfy-canvas">
      {{ t('workshop.examples.heading', locale) }}
    </h2>

    <p v-if="!examples.length" class="text-sm text-primary-warm-gray">
      {{ t('workshop.examples.empty', locale) }}
    </p>

    <div v-else>
      <ul class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <li
          v-for="example in examples"
          :key="example.id"
          class="group bg-transparency-white-t4 rounded-4.5xl flex flex-col border border-transparency-white-t8 px-2 pt-2 pb-4"
          data-testid="example-card"
        >
          <div
            class="bg-primary-comfy-ink-light relative aspect-4/3 overflow-hidden rounded-[2.25rem]"
          >
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
          <div class="flex flex-1 flex-col gap-2 px-4 pt-5 pb-2">
            <h3 class="text-lg/tight font-light text-primary-warm-white">
              {{ example.title }}
            </h3>
            <p class="line-clamp-3 text-sm text-primary-warm-gray">
              {{ example.description }}
            </p>
            <Button
              variant="link"
              size="sm"
              class="mt-auto"
              :append-icon="ArrowRight"
              data-testid="example-open"
              @click="emit('open', example)"
            >
              {{ t('workshop.examples.open', locale) }}
            </Button>
          </div>
        </li>
      </ul>
    </div>
  </section>
</template>
