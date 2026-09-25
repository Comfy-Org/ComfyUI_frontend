<script setup lang="ts">
import type { Locale } from '../../../i18n/translations'
import type { useCinematicEnhancement } from '../../../composables/useCinematicEnhancement'
import { tcEnhancement } from '../../../lib/workshop/cinematic-studio/enhancement-copy'
import type { WorkshopModelDetail } from '../../../config/models-catalogue'
const { run, model, scene, directions, locale } = defineProps<{
  run: ReturnType<typeof useCinematicEnhancement>
  model?: WorkshopModelDetail
  scene: string
  directions: string
  locale: Locale
}>()
const accepted = defineModel<boolean>('accepted', { required: true })
const { review, result, edited, proposed, busy } = run
const t = (key: Parameters<typeof tcEnhancement>[0]) =>
  tcEnhancement(key, locale)
</script>
<template>
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
      <dd class="max-h-28 overflow-y-auto wrap-break-word whitespace-pre-wrap">
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
</template>
