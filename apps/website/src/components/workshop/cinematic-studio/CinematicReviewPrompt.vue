<script setup lang="ts">
import type { CinematicReview } from '../../../composables/useCinematicShot'
import type { Locale } from '../../../i18n/translations'
import { libraryCopy } from '../../../lib/workshop/cinematic-studio/library-copy'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'
const { review, locale } = defineProps<{
  review: CinematicReview
  locale: Locale
}>()
</script>

<template>
  <div v-if="review.batch" class="flex flex-col gap-2">
    <p class="text-sm text-primary-comfy-canvas">
      {{ libraryCopy('separateClips', locale) }}
    </p>
    <ol
      class="max-h-52 list-inside list-decimal space-y-3 overflow-y-auto text-sm text-primary-warm-white"
    >
      <li
        v-for="(clip, index) in review.batch"
        :key="index"
        class="whitespace-pre-wrap"
      >
        {{ clip.prompt }}
      </li>
    </ol>
  </div>
  <div v-else class="flex flex-col gap-2">
    <h3 class="text-sm font-semibold text-primary-warm-white">
      {{ tc('cinematic.review.prompt', locale) }}
    </h3>
    <p
      class="max-h-32 overflow-y-auto rounded-xl border border-transparency-white-t8 p-4 text-sm/relaxed wrap-break-word whitespace-pre-wrap text-primary-comfy-canvas sm:max-h-48"
      tabindex="0"
    >
      {{ review.request.prompt }}
    </p>
  </div>
</template>
