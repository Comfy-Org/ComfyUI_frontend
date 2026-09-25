<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { WorkshopModelDetail } from '../../../config/models-catalogue'
import type { Locale } from '../../../i18n/translations'
import { useCinematicEnhancement } from '../../../composables/useCinematicEnhancement'
import { tcEnhancement } from '../../../lib/workshop/cinematic-studio/enhancement-copy'
import Button from '../../ui/button/Button.vue'
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
  review,
  result,
  edited,
  proposed,
  applyError,
  busy,
  error,
  canConfirm,
  saved,
  unresolved,
  canRecover,
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
      <dl class="flex flex-col gap-3 text-sm text-primary-warm-white">
        <div>
          <dt class="text-primary-comfy-canvas">{{ t('model') }}</dt>
          <dd>{{ model?.name || t('unavailable') }}</dd>
        </div>
        <div>
          <dt class="text-primary-comfy-canvas">{{ t('scene') }}</dt>
          <dd
            class="max-h-36 overflow-y-auto rounded-lg border border-transparency-white-t20 p-3 wrap-break-word whitespace-pre-wrap"
          >
            {{ result?.original ?? review?.brief.original ?? scene }}
          </dd>
        </div>
        <div v-if="!result">
          <dt class="text-primary-comfy-canvas">{{ t('directions') }}</dt>
          <dd
            class="max-h-28 overflow-y-auto wrap-break-word whitespace-pre-wrap"
          >
            {{ (review?.brief.directions ?? directions) || t('none') }}
          </dd>
        </div>
      </dl>
      <template v-if="result">
        <label class="flex flex-col gap-2 text-sm text-primary-warm-white"
          >{{ t('suggestion')
          }}<textarea
            v-model="edited"
            rows="5"
            class="min-w-0 rounded-lg border border-transparency-white-t20 bg-primary-comfy-ink p-3"
          />
        </label>
        <details>
          <summary class="text-sm text-primary-warm-white">
            {{ t('proposed') }}
          </summary>
          <p
            class="max-h-44 overflow-y-auto text-sm wrap-break-word whitespace-pre-wrap text-primary-comfy-canvas"
          >
            {{ proposed }}
          </p>
        </details>
        <p class="text-xs text-primary-comfy-canvas">
          {{ t('usage') }}: {{ result.inputTokens ?? t('unknown') }} /
          {{ result.outputTokens ?? t('unknown') }}
        </p>
      </template>
      <template v-else>
        <p class="text-sm text-primary-comfy-canvas">{{ t('privacy') }}</p>
        <p v-if="!run.demo" class="text-sm text-primary-comfy-canvas">
          {{ t('cost') }}
        </p>
        <label
          v-if="review && !busy && !run.demo"
          class="flex items-start gap-2 text-sm text-primary-warm-white"
          ><input v-model="accepted" type="checkbox" class="mt-1" />{{
            t('acknowledge')
          }}</label
        >
      </template>
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
      <div class="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" @click="close">{{ t('cancel') }}</Button>
        <Button v-if="canRecover" variant="outline" @click="run.recover">{{
          t('recover')
        }}</Button>
        <Button
          v-if="!busy && !unresolved && (result || error)"
          variant="outline"
          @click="back"
          >{{ t('newRequest') }}</Button
        >
        <Button v-if="result" :disabled="!proposed" @click="apply">{{
          t('apply')
        }}</Button>
        <template v-else-if="review">
          <Button v-if="!busy" variant="outline" @click="back">{{
            t('back')
          }}</Button>
          <Button
            :disabled="!canConfirm || (!run.demo && !accepted)"
            @click="run.confirm(run.demo || accepted)"
            >{{ t(run.demo ? 'demoConfirm' : 'confirm') }}</Button
          >
        </template>
        <Button
          v-else-if="!error"
          :disabled="gate !== 'ready'"
          @click="run.prepare"
          >{{ t('review') }}</Button
        >
      </div>
    </DialogContent>
  </Dialog>
</template>
