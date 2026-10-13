<script setup lang="ts">
import { ArrowRight, LoaderCircle } from '@lucide/vue'

import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { SwapExample } from '@/lib/workshop/openjutsu/examples'
import { SWAP_EXAMPLES } from '@/lib/workshop/openjutsu/examples'

/** The stage before a video: the frame the clip will fill, holding the examples; uploading lives in the panel. */
const { loading, locale = 'en' } = defineProps<{
  loading?: SwapExample['id']
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const emit = defineEmits<{ example: [example: SwapExample] }>()
</script>

<template>
  <section
    class="m-auto flex w-full max-w-4xl flex-col gap-3 rounded-2xl border border-dashed border-transparency-white-t20 p-4 sm:p-6"
    data-testid="openjutsu-empty"
  >
    <p class="text-sm text-primary-warm-white">
      {{ t('openjutsu.examples.title') }}
      <span class="text-primary-warm-gray"
        >· {{ t('openjutsu.examples.hint') }}</span
      >
    </p>
    <ul class="grid grid-cols-2 gap-2 sm:gap-3">
      <li v-for="example in SWAP_EXAMPLES" :key="example.id">
        <button
          type="button"
          :disabled="!!loading"
          :aria-busy="loading === example.id"
          class="group relative block aspect-video w-full cursor-pointer overflow-hidden rounded-xl border border-transparency-white-t8 text-left transition hover:border-primary-warm-white/50 focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none disabled:cursor-default"
          @click="emit('example', example)"
        >
          <img
            :src="example.poster"
            alt=""
            loading="lazy"
            class="size-full object-cover transition group-hover:scale-[1.02]"
          />
          <img
            :src="example.character"
            alt=""
            loading="lazy"
            class="absolute top-2.5 right-2.5 aspect-3/4 w-1/6 rounded-md border border-primary-warm-white/70 object-cover shadow-lg"
          />
          <span
            class="absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-linear-to-t from-primary-comfy-ink/90 to-transparent px-2.5 pt-6 pb-2 text-xs text-primary-warm-white sm:px-3.5 sm:pt-8 sm:pb-3 sm:text-sm"
          >
            {{ t(`openjutsu.examples.${example.id}.place`) }}
            <ArrowRight
              class="size-3.5 text-primary-warm-gray"
              aria-hidden="true"
            />
            {{ t(`openjutsu.examples.${example.id}.character`) }}
          </span>
          <span
            v-if="loading === example.id"
            class="absolute inset-0 grid place-items-center bg-primary-comfy-ink/60"
          >
            <LoaderCircle
              class="size-6 text-primary-comfy-yellow motion-safe:animate-spin"
              aria-hidden="true"
            />
          </span>
        </button>
      </li>
    </ul>
  </section>
</template>
