<script setup lang="ts">
import { computed } from 'vue'
import { useObjectUrl } from '@vueuse/core'
import type { CinematicReview } from '../../../composables/useCinematicShot'
import type { Locale } from '../../../i18n/translations'
import { libraryCopy } from '../../../lib/workshop/cinematic-studio/library-copy'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'
const { review, locale } = defineProps<{
  review: CinematicReview
  locale: Locale
}>()
const firstPreview = useObjectUrl(
  computed(() => review.request.video?.firstFrame)
)
const lastPreview = useObjectUrl(
  computed(() => review.request.video?.lastFrame)
)
const referenceNames = computed(() =>
  [
    ...review.request.references,
    review.request.video?.firstFrame,
    review.request.video?.lastFrame
  ]
    .filter((file): file is File => !!file)
    .map((file) => file.name)
    .join(', ')
)
</script>

<template>
  <dl class="grid grid-cols-2 gap-4 text-sm text-primary-warm-white">
    <div>
      <dt class="text-primary-comfy-canvas">
        {{ tc('cinematic.review.model', locale) }}
      </dt>
      <dd class="mt-1 wrap-break-word">{{ review.modelName }}</dd>
    </div>
    <div>
      <dt class="text-primary-comfy-canvas">
        {{ tc('cinematic.review.format', locale) }}
      </dt>
      <dd class="mt-1">
        {{
          review.adaptiveAspect
            ? libraryCopy('providerAspect', locale)
            : review.request.aspect
        }}
        · {{ review.resolution }}
      </dd>
    </div>
    <div>
      <dt class="text-primary-comfy-canvas">
        {{ tc('cinematic.review.takes', locale) }}
      </dt>
      <dd class="mt-1">{{ review.request.takes }}</dd>
    </div>
    <div>
      <dt class="text-primary-comfy-canvas">
        {{ tc('cinematic.review.references', locale) }}
      </dt>
      <dd class="mt-1 wrap-break-word">
        {{ referenceNames || tc('cinematic.review.none', locale) }}
      </dd>
    </div>
    <div v-if="review.request.seed !== undefined">
      <dt class="text-primary-comfy-canvas">
        {{ libraryCopy('seed', locale) }}
      </dt>
      <dd>{{ review.request.seed }}</dd>
    </div>
    <div v-if="review.request.video">
      <dt class="text-primary-comfy-canvas">
        {{ tc('cinematic.video.audio', locale) }}
      </dt>
      <dd class="mt-1">
        {{
          tc(
            review.request.video.generateAudio
              ? 'cinematic.video.audioOn'
              : 'cinematic.video.audioOff',
            locale
          )
        }}
      </dd>
    </div>
  </dl>
  <div v-if="firstPreview || lastPreview" class="grid grid-cols-2 gap-3">
    <img
      v-if="firstPreview"
      :src="firstPreview"
      :alt="tc('cinematic.video.firstFrame', locale)"
      class="h-28 w-full rounded-lg object-contain"
    />
    <img
      v-if="lastPreview"
      :src="lastPreview"
      :alt="tc('cinematic.video.lastFrame', locale)"
      class="h-28 w-full rounded-lg object-contain"
    />
  </div>
</template>
