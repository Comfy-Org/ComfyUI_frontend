<script setup lang="ts">
import { ArrowRight } from '@lucide/vue'

import Button from '@/components/ui/button/Button.vue'
import { translationsFor } from '@/i18n/translations'
import {
  STARTER_SHOTS,
  starterRecipe
} from '@/lib/workshop/cinematic-studio/starters'
import type { Locale } from '@/i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const emit = defineEmits<{ use: [id: string] }>()
const { t } = translationsFor(locale)
</script>

<template>
  <section aria-labelledby="cinematic-starters">
    <h2
      id="cinematic-starters"
      class="text-2xl font-semibold text-primary-warm-white lg:text-4xl"
    >
      {{ t('cinematic.detail.startersTitle') }}
    </h2>
    <p class="mt-3 max-w-2xl text-primary-warm-gray lg:text-lg">
      {{ t('cinematic.detail.startersLead') }}
    </p>
    <ul class="mt-8 grid gap-6 lg:grid-cols-3">
      <li
        v-for="shot in STARTER_SHOTS"
        :key="shot.id"
        class="flex flex-col overflow-hidden rounded-3xl bg-transparency-white-t4 ring-1 ring-transparency-white-t8"
      >
        <img
          :src="shot.image"
          :alt="t(shot.label)"
          class="aspect-video w-full object-cover"
          loading="lazy"
        />
        <div class="flex flex-1 flex-col gap-4 p-5">
          <h3 class="text-lg font-semibold text-primary-warm-white">
            {{ t(shot.label) }}
          </h3>
          <p class="text-sm text-primary-warm-gray">{{ shot.scene }}</p>
          <ul class="flex flex-wrap gap-1.5">
            <li
              v-for="option in starterRecipe(shot)"
              :key="option.id"
              class="rounded-full border border-transparency-white-t20 px-2.5 py-0.5 text-xs text-primary-comfy-canvas"
            >
              {{ t(option.label) }}
            </li>
          </ul>
          <Button
            type="button"
            variant="ghost"
            :append-icon="ArrowRight"
            class="mt-auto self-start"
            data-testid="cinematic-use-shot"
            @click="emit('use', shot.id)"
          >
            {{ t('cinematic.detail.useShot') }}
          </Button>
        </div>
      </li>
    </ul>
  </section>
</template>
