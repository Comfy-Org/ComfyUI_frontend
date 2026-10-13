<script setup lang="ts">
import { ArrowLeft, LoaderCircle } from '@lucide/vue'

import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { SwapExample } from '@/lib/workshop/openjutsu/examples'
import { SWAP_EXAMPLES } from '@/lib/workshop/openjutsu/examples'

/** The stage before a video: a card of examples to start from; uploading lives in the panel. */
const { loading, locale = 'en' } = defineProps<{
  loading?: SwapExample['id']
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const emit = defineEmits<{ example: [example: SwapExample] }>()

const exampleName = (example: SwapExample) =>
  `${t(`openjutsu.examples.${example.id}.place`)} → ${t(`openjutsu.examples.${example.id}.character`)}`
</script>

<template>
  <section
    class="m-auto flex w-full max-w-3xl flex-col gap-5 rounded-2xl border border-transparency-white-t8 bg-primary-comfy-ink-light/80 p-5 backdrop-blur-sm sm:gap-6 sm:p-7"
    data-testid="openjutsu-empty"
  >
    <div class="flex flex-col gap-2">
      <h2 class="text-lg font-medium text-primary-warm-white sm:text-xl">
        {{ t('openjutsu.examples.title') }}
      </h2>
      <p class="text-sm text-primary-warm-gray">
        {{ t('openjutsu.examples.hint') }}
      </p>
      <p
        class="flex items-center gap-2 text-sm text-primary-warm-white max-md:hidden"
      >
        <ArrowLeft class="size-4 text-primary-warm-gray" aria-hidden="true" />
        {{ t('openjutsu.examples.upload') }}
      </p>
    </div>
    <ul class="grid grid-cols-2 gap-2 sm:gap-3">
      <li v-for="example in SWAP_EXAMPLES" :key="example.id">
        <button
          type="button"
          :disabled="!!loading"
          :aria-busy="loading === example.id"
          :aria-label="exampleName(example)"
          class="group relative block aspect-video w-full cursor-pointer overflow-hidden rounded-xl border border-transparency-white-t8 transition hover:border-primary-warm-white/50 focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none disabled:cursor-default"
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
            class="absolute top-2 right-2 aspect-3/4 w-1/5 rounded-md border border-primary-warm-white/70 object-cover shadow-lg"
          />
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
