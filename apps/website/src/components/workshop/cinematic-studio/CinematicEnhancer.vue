<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { WorkshopModelDetail } from '../../../config/models-catalogue'
import type { Locale } from '../../../i18n/translations'
import { useCinematicEnhancement } from '../../../composables/useCinematicEnhancement'
import { tcEnhancement } from '../../../lib/workshop/cinematic-studio/enhancement-copy'
import CinematicEnhancementContent from './CinematicEnhancementContent.vue'
import CinematicEnhancementActions from './CinematicEnhancementActions.vue'
import Dialog from '../../ui/dialog/Dialog.vue'
import DialogContent from '../../ui/dialog/DialogContent.vue'
import DialogDescription from '../../ui/dialog/DialogDescription.vue'
import DialogTitle from '../../ui/dialog/DialogTitle.vue'

const {
  open,
  scene,
  directions,
  namespace,
  mode = 'image',
  model,
  promptLimit = 8000,
  locale = 'en'
} = defineProps<{
  open: boolean
  scene: string
  directions: string
  namespace: string
  mode?: 'image' | 'video'
  model?: WorkshopModelDetail
  promptLimit?: number
  locale?: Locale
}>()
const emit = defineEmits<{ 'update:open': [boolean]; apply: [string] }>()
const run = useCinematicEnhancement({
  model: () => model,
  input: () => ({ scene, directions, mode, promptLimit }),
  namespace: () => namespace
})
const {
  proposed,
  applyError,
  busy,
  error,
  saved,
  unresolved,
  storageError,
  gate
} = run
const accepted = ref(false)
const t = (key: Parameters<typeof tcEnhancement>[0]) =>
  tcEnhancement(key, locale)
watch(
  () => [open, namespace],
  () => {
    accepted.value = false
  }
)
watch(
  () => [scene, directions, mode, model?.slug, promptLimit],
  () => {
    accepted.value = false
  }
)
const failure = computed(
  () =>
    error.value ??
    applyError.value ??
    (gate.value !== 'ready' ? gate.value : undefined)
)
function close() {
  emit('update:open', false)
}
function apply() {
  if (!proposed.value || busy.value) return
  emit('apply', proposed.value)
  close()
}
function back() {
  accepted.value = false
  run.reset()
}
</script>
<template>
  <Dialog :open @update:open="!$event && close()">
    <DialogContent
      class="flex max-h-[90svh] flex-col gap-4 overflow-y-auto sm:max-w-2xl"
      :close-label="t('cancel')"
    >
      <DialogTitle class="pr-12">{{ t('title') }}</DialogTitle>
      <DialogDescription>{{ t('description') }}</DialogDescription>
      <p v-if="run.demo" class="text-sm text-primary-comfy-canvas">
        {{ t('demoNotice') }}
      </p>
      <CinematicEnhancementContent
        v-model:accepted="accepted"
        :run
        :model
        :scene
        :directions
        :locale
      />
      <p v-if="busy" role="status" class="text-sm text-primary-warm-white">
        {{ t('running') }}
      </p>
      <p
        v-if="storageError"
        role="alert"
        class="text-sm text-primary-warm-white"
      >
        {{ t('storageError') }}
      </p>
      <p v-if="unresolved" class="text-sm text-primary-comfy-canvas">
        {{ t('retained')
        }}<span v-if="saved?.requestId" class="block break-all"
          >{{ t('requestId') }}: {{ saved.requestId }}</span
        ><span v-else class="block break-all"
          >{{ t('submissionId') }}: {{ saved?.id }} ·
          {{ t('noAdmission') }}</span
        >
      </p>
      <p v-if="failure" role="alert" class="text-sm text-primary-warm-white">
        {{ t(failure) }}
      </p>
      <CinematicEnhancementActions
        :run
        :accepted
        :locale
        @close="close"
        @back="back"
        @apply="apply"
      />
    </DialogContent>
  </Dialog>
</template>
