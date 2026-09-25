<script setup lang="ts">
import type { Locale } from '../../../i18n/translations'
import { tcBuilder } from '../../../lib/workshop/cinematic-studio/builder-copy'
import Button from '../../ui/button/Button.vue'
import type { SavedCreation } from '../../../lib/workshop/cinematic-studio/creations'
import {
  SCENE_LIMIT,
  plannedReferenceIds
} from '../../../lib/workshop/cinematic-studio/scene-builder'
import type {
  createSceneBuilderDraft,
  plannedShotTakes
} from '../../../lib/workshop/cinematic-studio/scene-builder'
import CinematicPlannedTakes from './CinematicPlannedTakes.vue'
type Plan = ReturnType<typeof createSceneBuilderDraft>['plan']
const { index, plan, preview, takes, urls, fieldClass, locale } = defineProps<{
  index: number
  plan: Plan
  preview: { valid: boolean; text: string }
  takes: ReturnType<typeof plannedShotTakes>
  urls: Readonly<Record<string, string>>
  fieldClass: string
  locale: Locale
}>()
const shot = defineModel<Plan['shots'][number]>('shot', { required: true })
const revealed = defineModel<string[]>('revealed', { required: true })
const emit = defineEmits<{
  selectReference: [string, Event]
  apply: [string]
  useTake: [action: 'view' | 'edit' | 'animate', creation: SavedCreation]
}>()
const t = (key: Parameters<typeof tcBuilder>[0]) => tcBuilder(key, locale)
</script>
<template>
  <article
    class="flex min-w-0 flex-col gap-3 rounded-xl border border-transparency-white-t8 p-3"
  >
    <label class="flex flex-col gap-1 text-sm text-primary-warm-white"
      >{{ index + 1 }} · {{ t('shotTitle')
      }}<input v-model="shot.title" :class="fieldClass" maxlength="100"
    /></label>
    <label class="flex flex-col gap-1 text-sm text-primary-warm-white"
      >{{ t('action')
      }}<textarea
        v-model="shot.action"
        :class="fieldClass"
        :maxlength="SCENE_LIMIT"
        rows="2"
      />
    </label>
    <label class="flex flex-col gap-1 text-sm text-primary-warm-white"
      >{{ t('framing')
      }}<textarea
        v-model="shot.framing"
        :class="fieldClass"
        :maxlength="SCENE_LIMIT"
        rows="5"
      />
    </label>
    <details class="text-sm text-primary-comfy-canvas">
      <summary class="cursor-pointer">{{ t('shotSettings') }}</summary>
      <label class="mt-2 flex items-center gap-2"
        ><input v-model="shot.includeSharedBrief" type="checkbox" />{{
          t('includeSharedBrief')
        }}</label
      >
      <fieldset v-if="plan.settings" class="mt-3 flex flex-col gap-2">
        <legend>{{ t('references') }}</legend>
        <p class="text-xs">{{ t('referenceNote') }}</p>
        <label
          v-for="reference in plan.settings.references"
          :key="reference.id"
          class="flex min-w-0 items-center gap-2"
          ><input
            type="checkbox"
            :checked="plannedReferenceIds(plan, index)?.includes(reference.id)"
            @change="emit('selectReference', reference.id, $event)"
          /><span class="wrap-break-word">{{ reference.label }}</span></label
        >
        <p v-if="!plan.settings.references.length">
          {{ t('noReferences') }}
        </p>
      </fieldset>
    </details>
    <details class="text-sm text-primary-comfy-canvas">
      <summary class="cursor-pointer">{{ t('preview') }}</summary>
      <p class="mt-2 wrap-break-word whitespace-pre-wrap">
        {{ preview.valid ? preview.text : t('invalid') }}
      </p>
    </details>
    <Button :disabled="!preview.valid" @click="emit('apply', preview.text)">{{
      t('apply')
    }}</Button>
    <CinematicPlannedTakes
      v-model:revealed="revealed"
      :takes
      :urls
      :locale
      @use-take="(action, creation) => emit('useTake', action, creation)"
    />
  </article>
</template>
