<script setup lang="ts">
import { useObjectUrl } from '@vueuse/core'
import { computed, watch } from 'vue'
import type { CinematicReview } from '../../../composables/useCinematicShot'
import type { Locale } from '../../../i18n/translations'
import { libraryCopy } from '../../../lib/workshop/cinematic-studio/library-copy'
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
const firstPreview = useObjectUrl(
  computed(() => review?.request.video?.firstFrame)
)
const lastPreview = useObjectUrl(
  computed(() => review?.request.video?.lastFrame)
)
const emit = defineEmits<{ confirm: []; close: [] }>()
const referenceNames = computed(() =>
  review
    ? [
        ...review.request.references,
        review.request.video?.firstFrame,
        review.request.video?.lastFrame
      ]
        .filter((file): file is File => !!file)
        .map((file) => file.name)
        .join(', ')
    : ''
)
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
