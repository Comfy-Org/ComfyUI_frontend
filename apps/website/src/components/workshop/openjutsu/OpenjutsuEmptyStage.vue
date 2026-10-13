<script setup lang="ts">
import { ArrowRight, LoaderCircle } from '@lucide/vue'

import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { SwapExample } from '@/lib/workshop/openjutsu/examples'
import { SWAP_EXAMPLES } from '@/lib/workshop/openjutsu/examples'

/** The stage before a video: examples to start from; uploading lives in the panel. */
const { loading, locale = 'en' } = defineProps<{
  /** The example being fetched. */
  loading?: SwapExample['id']
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const emit = defineEmits<{ example: [example: SwapExample] }>()
</script>

<template>
  <section
    class="my-auto flex w-full max-w-4xl flex-col gap-4 self-center"
    data-testid="openjutsu-empty"
  >
    <div class="flex flex-col gap-1">
      <h2 class="text-base font-medium text-primary-warm-white">
        {{ t('openjutsu.examples.title') }}
      </h2>
      <p class="text-sm text-primary-warm-gray">
        {{ t('openjutsu.examples.hint') }}
      </p>
    </div>
    <ul class="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <li v-for="example in SWAP_EXAMPLES" :key="example.id">
        <button
          type="button"
          :disabled="!!loading"
          :aria-busy="loading === example.id"
          class="group flex w-full cursor-pointer flex-col gap-2 text-left focus-visible:outline-none disabled:cursor-default"
          @click="emit('example', example)"
        >
          <span
            class="relative block aspect-video overflow-hidden rounded-xl border border-transparency-white-t8 transition group-hover:border-primary-warm-white/50 group-focus-visible:ring-3 group-focus-visible:ring-primary-comfy-yellow/50"
          >
            <img
              :src="example.poster"
              alt=""
              loading="lazy"
              class="size-full object-cover"
            />
            <img
              :src="example.character"
              alt=""
              loading="lazy"
              class="absolute right-2 bottom-2 aspect-3/4 w-1/5 rounded-md border border-primary-warm-white/70 object-cover shadow-lg"
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
          </span>
          <span
            class="flex items-center gap-1.5 text-sm text-primary-warm-white"
          >
            {{ t(`openjutsu.examples.${example.id}.place`) }}
            <ArrowRight
              class="size-3.5 text-primary-warm-gray"
              aria-hidden="true"
            />
            {{ t(`openjutsu.examples.${example.id}.character`) }}
          </span>
        </button>
      </li>
    </ul>
  </section>
</template>
