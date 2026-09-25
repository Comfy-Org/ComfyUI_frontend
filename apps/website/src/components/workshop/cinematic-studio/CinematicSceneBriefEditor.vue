<script setup lang="ts">
import type { Locale } from '../../../i18n/translations'
import { tcBuilder } from '../../../lib/workshop/cinematic-studio/builder-copy'
import Button from '../../ui/button/Button.vue'
import {
  BRIEF_FIELDS,
  SCENE_LIMIT
} from '../../../lib/workshop/cinematic-studio/scene-builder'
import type { createSceneBuilderDraft } from '../../../lib/workshop/cinematic-studio/scene-builder'
const { brief, fieldClass, locale } = defineProps<{
  brief: { valid: boolean; text: string }
  fieldClass: string
  locale: Locale
}>()
const briefDraft = defineModel<
  ReturnType<typeof createSceneBuilderDraft>['brief']
>({ required: true })
const emit = defineEmits<{ apply: [string] }>()
const t = (key: Parameters<typeof tcBuilder>[0]) => tcBuilder(key, locale)
</script>
<template>
  <div class="grid min-w-0 gap-5 md:grid-cols-2">
    <div class="flex min-w-0 flex-col gap-3">
      <label
        v-for="field in BRIEF_FIELDS"
        :key="field"
        class="flex flex-col gap-1 text-sm text-primary-warm-white"
      >
        {{ t(field)
        }}<span
          v-if="field !== 'subject'"
          class="text-xs text-primary-comfy-canvas"
          >{{ t('optional') }}</span
        >
        <textarea
          v-model="briefDraft[field]"
          :class="fieldClass"
          :maxlength="SCENE_LIMIT"
          :rows="field === 'subject' ? 4 : 2"
        />
      </label>
    </div>
    <section class="min-w-0">
      <h3 class="mb-2 text-sm font-semibold text-primary-warm-white">
        {{ t('preview') }}
      </h3>
      <p
        class="rounded-xl border border-transparency-white-t8 p-4 text-sm/relaxed wrap-break-word whitespace-pre-wrap text-primary-comfy-canvas"
      >
        {{ brief.valid ? brief.text : t('invalid') }}
      </p>
      <p class="my-3 text-xs text-primary-comfy-canvas">
        {{ brief.text.length }} / {{ SCENE_LIMIT }} {{ t('characters') }}
      </p>
      <Button :disabled="!brief.valid" @click="emit('apply', brief.text)">{{
        t('apply')
      }}</Button>
    </section>
  </div>
</template>
