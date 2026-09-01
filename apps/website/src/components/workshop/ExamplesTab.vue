<script setup lang="ts">
import { ArrowRight } from '@lucide/vue'

import Button from '@/components/ui/button/Button.vue'
import type { PlaygroundExample } from '../../config/workshop-playground'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { examples, locale = 'en' } = defineProps<{
  examples: readonly PlaygroundExample[]
  locale?: Locale
}>()

const emit = defineEmits<{ open: [example: PlaygroundExample] }>()

function promptOf(example: PlaygroundExample): string {
  const prompt = example.values.prompt
  return typeof prompt === 'string' ? prompt : ''
}
</script>

<template>
  <section class="flex flex-col gap-6" data-testid="examples-tab">
    <h2 class="text-2xl font-bold text-primary-comfy-canvas">
      {{ t('workshop.examples.heading', locale) }}
    </h2>

    <p v-if="!examples.length" class="text-sm text-primary-warm-gray">
      {{ t('workshop.examples.empty', locale) }}
    </p>

    <ul v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <li
        v-for="example in examples"
        :key="example.id"
        class="bg-transparency-white-t4 flex flex-col overflow-hidden rounded-2xl border border-transparency-white-t8"
        data-testid="example-card"
      >
        <div class="aspect-4/3 bg-primary-comfy-ink">
          <img
            v-if="example.outputUrl && !example.outputUrl.endsWith('.mp4')"
            :src="example.outputUrl"
            alt=""
            class="size-full object-cover"
            loading="lazy"
          />
          <video
            v-else-if="example.outputUrl"
            :src="example.outputUrl"
            class="size-full object-cover"
            muted
            loop
            playsinline
            autoplay
          />
        </div>
        <div class="flex flex-1 flex-col gap-2 p-4">
          <h3 class="text-base font-semibold text-primary-comfy-canvas">
            {{ t(example.title, locale) }}
          </h3>
          <p class="line-clamp-3 text-sm text-primary-warm-gray">
            {{ promptOf(example) }}
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
  </section>
</template>
