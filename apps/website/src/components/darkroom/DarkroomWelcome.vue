<script setup lang="ts">
import { computed } from 'vue'

import { DARKROOM_EXAMPLES } from '@/lib/darkroom/vocabulary'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

const { signedOut, locale = 'en' } = defineProps<{
  /** A visitor who has not signed in yet is told to, before anything else. */
  signedOut: boolean
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const emit = defineEmits<{ example: [prompt: string] }>()

const TIPS = ['edit', 'combine', 'build', 'style', 'keys'] as const

const lede = computed(() =>
  signedOut ? t('darkroom.welcome.signedOut') : t('darkroom.welcome.lede')
)
const examples = DARKROOM_EXAMPLES.map((key) => ({
  key,
  tag: t(`darkroom.welcome.examples.${key}.tag`),
  prompt: t(`darkroom.welcome.examples.${key}.prompt`)
}))

const label =
  'text-xs font-bold tracking-wider text-primary-comfy-canvas uppercase'
</script>

<template>
  <div
    class="mx-auto mt-10 mb-16 w-full max-w-10xl px-4 sm:px-8 lg:px-14"
    data-testid="darkroom-welcome"
  >
    <h2 class="mb-2 text-xl font-semibold text-primary-warm-white lg:text-2xl">
      {{ t('darkroom.welcome.heading') }}
    </h2>
    <p class="mb-8 max-w-160 text-base/relaxed text-primary-warm-gray">
      {{ lede }}
    </p>
    <div :class="label" class="mb-3">{{ t('darkroom.welcome.tryOne') }}</div>
    <div class="mb-9 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <button
        v-for="example in examples"
        :key="example.key"
        type="button"
        class="flex cursor-pointer flex-col justify-start rounded-2xl border border-transparency-white-t8 bg-transparency-white-t4 px-4.5 py-4 text-left text-sm/relaxed text-content transition-colors hover:border-transparency-white-t20 hover:text-primary-warm-white"
        @click="emit('example', example.prompt)"
      >
        <span :class="label" class="mb-1.5 block">{{ example.tag }}</span>
        {{ example.prompt }}
      </button>
    </div>
    <div :class="label" class="mb-3">
      {{ t('darkroom.welcome.goodToKnow') }}
    </div>
    <ul
      class="grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2 xl:grid-cols-4"
    >
      <li
        v-for="tip in TIPS"
        :key="tip"
        class="text-sm/relaxed text-content-muted"
      >
        <span class="text-primary-warm-white">
          {{ t(`darkroom.welcome.tips.${tip}.lead`) }}
        </span>
        {{ t(`darkroom.welcome.tips.${tip}.body`) }}
      </li>
    </ul>
  </div>
</template>
