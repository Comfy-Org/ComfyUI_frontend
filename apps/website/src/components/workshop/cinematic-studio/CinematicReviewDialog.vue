<script setup lang="ts">
import CinematicReviewPrompt from './CinematicReviewPrompt.vue'
import CinematicReviewMetadata from './CinematicReviewMetadata.vue'
import { watch } from 'vue'
import type { CinematicReview } from '../../../composables/useCinematicShot'
import type { Locale } from '../../../i18n/translations'
import { libraryCopy } from '../../../lib/workshop/cinematic-studio/library-copy'
import { tcEditing } from '../../../lib/workshop/cinematic-studio/editing-copy'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'
import Button from '../../ui/button/Button.vue'
import Dialog from '../../ui/dialog/Dialog.vue'
import DialogContent from '../../ui/dialog/DialogContent.vue'
import DialogDescription from '../../ui/dialog/DialogDescription.vue'
import DialogTitle from '../../ui/dialog/DialogTitle.vue'

const {
  review,
  canConfirm,
  referenceSaveError = false,
  referencePreparing = false,
  locale = 'en'
} = defineProps<{
  review: CinematicReview | undefined
  canConfirm: boolean
  referenceSaveError?: boolean
  referencePreparing?: boolean
  locale?: Locale
}>()
const emit = defineEmits<{ confirm: []; close: [] }>()
let returnFocus: HTMLElement | undefined
watch(
  () => !!review,
  (open) => {
    if (open)
      returnFocus =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : undefined
  }
)
</script>

<template>
  <Dialog :open="!!review" @update:open="!$event && emit('close')">
    <DialogContent
      class="flex flex-col gap-5 sm:max-w-2xl"
      :close-label="tc('cinematic.picker.close', locale)"
      @close-auto-focus.prevent="returnFocus?.focus()"
    >
      <DialogTitle class="pr-14">
        {{ tc('cinematic.review.title', locale) }}
      </DialogTitle>
      <DialogDescription>
        {{ tc('cinematic.review.description', locale) }}
      </DialogDescription>
      <template v-if="review">
        <CinematicReviewMetadata :review :locale />
        <CinematicReviewPrompt :review :locale />
        <p
          v-if="review.request.editing && review.request.takes > 1"
          class="text-sm text-primary-comfy-canvas"
        >
          {{ tcEditing('variationsNote', locale) }}
        </p>
        <p class="text-xs/relaxed text-primary-comfy-canvas">
          {{ tc('cinematic.review.credits', locale) }}
        </p>
        <p
          v-if="referencePreparing"
          role="status"
          class="text-sm text-primary-warm-white"
        >
          {{ libraryCopy('referencePreparing', locale) }}
        </p>
        <p
          v-if="referenceSaveError"
          role="alert"
          class="text-sm text-primary-warm-white"
        >
          {{ libraryCopy('referenceSaveError', locale) }}
        </p>
        <p
          v-if="!canConfirm && !referencePreparing"
          role="status"
          class="text-sm text-primary-warm-white"
        >
          {{ tc('cinematic.review.changed', locale) }}
        </p>
        <div class="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button variant="outline" @click="emit('close')">{{
            tc('cinematic.review.back', locale)
          }}</Button>
          <Button :disabled="!canConfirm" @click="emit('confirm')">{{
            tc('cinematic.review.confirm', locale)
          }}</Button>
        </div>
      </template>
    </DialogContent>
  </Dialog>
</template>
