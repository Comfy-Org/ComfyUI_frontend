<script setup lang="ts">
import type { Locale } from '../../../i18n/translations'
import type { useCinematicShot } from '../../../composables/useCinematicShot'
import { tcAssets } from '../../../lib/workshop/cinematic-studio/assets-copy'
import { libraryCopy } from '../../../lib/workshop/cinematic-studio/library-copy'
const { shot, locale } = defineProps<{
  shot: ReturnType<typeof useCinematicShot>
  locale: Locale
}>()
const {
  library,
  assetLimitReached,
  mode,
  references,
  selectedModel,
  referenceSaveError,
  review,
  restoreError,
  restored
} = shot
</script>

<template>
  <p
    v-if="assetLimitReached"
    role="status"
    class="text-xs text-primary-comfy-canvas"
  >
    {{ tcAssets('limit', locale) }}
  </p>
  <slot />
  <p
    v-if="
      mode === 'image' &&
      references.length &&
      (!selectedModel?.referenceModelSlug ||
        references.length > (selectedModel.referenceMax ?? 0))
    "
    role="status"
    class="text-xs text-primary-comfy-canvas"
  >
    {{ libraryCopy('referenceUnsupported', locale) }}
  </p>
  <p
    v-if="referenceSaveError && !review"
    role="alert"
    class="text-xs text-primary-comfy-canvas"
  >
    {{ libraryCopy('referenceSaveError', locale) }}
  </p>
  <p v-if="restoreError" role="alert" class="text-xs text-primary-comfy-canvas">
    {{ libraryCopy('restoreError', locale) }}
  </p>
  <p v-if="restored" role="status" class="text-xs text-primary-comfy-canvas">
    {{ libraryCopy('reuseNotice', locale) }}
  </p>
  <p
    v-if="library.error.value"
    role="alert"
    class="text-xs text-primary-comfy-canvas"
  >
    {{ libraryCopy('error', locale) }}
  </p>
</template>
