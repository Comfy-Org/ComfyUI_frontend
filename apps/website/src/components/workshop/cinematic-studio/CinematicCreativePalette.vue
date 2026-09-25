<script setup lang="ts">
import type { Locale } from '../../../i18n/translations'
import type { CreativeSettings } from '../../../lib/workshop/cinematic-studio/creative'
import { tcCreative } from '../../../lib/workshop/cinematic-studio/creative-copy'
import { HARMONIES } from '../../../lib/workshop/cinematic-studio/creative'
import CinematicPresetSection from './CinematicPresetSection.vue'
const { locale, fieldClass, actionClass, valid, sampling, namespace } =
  defineProps<{
    locale: Locale
    fieldClass: string
    actionClass: string
    valid: boolean
    sampling: boolean
    namespace: string
  }>()
const harmony = defineModel<(typeof HARMONIES)[number]>('harmony', {
  required: true
})
const emit = defineEmits<{
  moveColor: [number, number]
  removeColor: [number]
  buildHarmony: []
  sampleImage: [Event]
}>()
const draft = defineModel<CreativeSettings>({ required: true })
const t = (key: Parameters<typeof tcCreative>[0]) => tcCreative(key, locale)
</script>
<template>
  <section :aria-label="t('palette')" class="flex flex-col gap-3">
    <h3 class="font-semibold">
      {{ t('palette') }} · {{ draft.palette.length }}/8
    </h3>
    <div
      v-for="(_, index) in draft.palette"
      :key="index"
      class="flex flex-wrap items-center gap-2"
    >
      <input
        v-model="draft.palette[index]"
        type="color"
        class="h-9 w-10 shrink-0"
        :aria-label="`${t('color')} ${index + 1}`"
      />
      <input
        v-model="draft.palette[index]"
        :class="fieldClass"
        class="w-28"
        maxlength="7"
        pattern="#[0-9a-fA-F]{6}"
        :aria-label="`${t('color')} ${index + 1} HEX`"
      />
      <button
        type="button"
        :class="actionClass"
        :aria-label="`${t('earlier')}: ${t('color')} ${index + 1}`"
        :disabled="index === 0 || !valid"
        @click="emit('moveColor', index, -1)"
      >
        ↑
      </button>
      <button
        type="button"
        :class="actionClass"
        :aria-label="`${t('later')}: ${t('color')} ${index + 1}`"
        :disabled="index === draft.palette.length - 1 || !valid"
        @click="emit('moveColor', index, 1)"
      >
        ↓
      </button>
      <button
        type="button"
        :class="actionClass"
        :disabled="!valid"
        @click="emit('removeColor', index)"
      >
        {{ t('remove') }}
      </button>
    </div>
    <button
      type="button"
      :class="actionClass"
      :disabled="draft.palette.length >= 8"
      @click="draft.palette.push('#808080')"
    >
      {{ t('addColor') }}
    </button>
    <label v-if="draft.palette.length" class="flex flex-col gap-2 text-sm"
      >{{ t('main')
      }}<select v-model="draft.paletteMain" :class="fieldClass">
        <option :value="null">{{ t('noMain') }}</option>
        <option
          v-for="(color, index) in draft.palette"
          :key="index"
          :value="index"
        >
          {{ index + 1 }} · {{ color }}
        </option>
      </select></label
    >
    <div v-if="draft.palette.length" class="flex flex-wrap gap-2">
      <select v-model="harmony" :class="fieldClass" :aria-label="t('harmony')">
        <option v-for="value in HARMONIES" :key="value" :value>
          {{ t(value) }}
        </option></select
      ><button
        type="button"
        :class="actionClass"
        :disabled="!valid"
        @click="emit('buildHarmony')"
      >
        {{ t('buildHarmony') }}
      </button>
    </div>
    <label class="flex flex-col gap-2 text-sm"
      >{{ t('sample')
      }}<input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        class="max-w-full text-xs"
        :disabled="sampling"
        @change="emit('sampleImage', $event)"
    /></label>
    <CinematicPresetSection v-model="draft" kind="palette" :namespace :locale />
  </section>
</template>
