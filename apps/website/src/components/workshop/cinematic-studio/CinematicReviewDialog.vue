<script setup lang="ts">
import { watch } from 'vue'
import type { CinematicReview } from '../../../composables/useCinematicShot'
import type { Locale } from '../../../i18n/translations'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'
import Button from '../../ui/button/Button.vue'
import Dialog from '../../ui/dialog/Dialog.vue'
import DialogContent from '../../ui/dialog/DialogContent.vue'
import DialogDescription from '../../ui/dialog/DialogDescription.vue'
import DialogTitle from '../../ui/dialog/DialogTitle.vue'

const {
  review,
  canConfirm,
  locale = 'en'
} = defineProps<{
  review: CinematicReview | undefined
  canConfirm: boolean
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
              {{ review.request.aspect }} · {{ review.resolution }}
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
              {{
                review.request.references.map((file) => file.name).join(', ') ||
                tc('cinematic.review.none', locale)
              }}
            </dd>
          </div>
        </dl>
        <div class="flex flex-col gap-2">
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
          v-if="!canConfirm"
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
