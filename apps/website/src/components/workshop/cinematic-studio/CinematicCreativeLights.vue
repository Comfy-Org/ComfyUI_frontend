<script setup lang="ts">
import type { Locale } from '../../../i18n/translations'
import type { CreativeSettings } from '../../../lib/workshop/cinematic-studio/creative'
import { tcCreative } from '../../../lib/workshop/cinematic-studio/creative-copy'
import { LIGHT_POSITIONS } from '../../../lib/workshop/cinematic-studio/creative'
import CinematicPresetSection from './CinematicPresetSection.vue'
import CinematicLightingDiagram from './CinematicLightingDiagram.vue'
const { locale, fieldClass, actionClass, namespace } = defineProps<{
  locale: Locale
  fieldClass: string
  actionClass: string
  namespace: string
}>()
const draft = defineModel<CreativeSettings>({ required: true })
const t = (key: Parameters<typeof tcCreative>[0]) => tcCreative(key, locale)
</script>
<template>
  <section :aria-label="t('lights')" class="flex flex-col gap-3">
    <h3 class="font-semibold">
      {{ t('lights') }} · {{ draft.lights.length }}/3
    </h3>
    <CinematicLightingDiagram :lights="draft.lights" :locale />
    <div
      v-for="(light, index) in draft.lights"
      :key="index"
      class="grid grid-cols-2 gap-3 rounded-lg border border-transparency-white-t20 p-3"
    >
      <label class="flex flex-col gap-2 text-sm"
        >{{ t('position') }} {{ index + 1
        }}<select v-model="light.position" :class="fieldClass">
          <option v-for="value in LIGHT_POSITIONS" :key="value" :value>
            {{ t(value) }}
          </option>
        </select></label
      >
      <label class="flex flex-col gap-2 text-sm"
        >{{ t('color') }} {{ index + 1
        }}<input v-model="light.color" type="color" class="h-9 w-full"
      /></label>
      <label class="flex flex-col gap-2 text-sm"
        >{{ t('brightness') }} {{ light.brightness }}%<input
          v-model.number="light.brightness"
          type="range"
          min="0"
          max="100"
      /></label>
      <label class="flex flex-col gap-2 text-sm"
        >{{ t('diffusion') }} {{ light.diffusion }}%<input
          v-model.number="light.diffusion"
          type="range"
          min="0"
          max="100"
      /></label>
      <button
        type="button"
        :class="actionClass"
        @click="draft.lights.splice(index, 1)"
      >
        {{ t('remove') }}
      </button>
    </div>
    <button
      type="button"
      :class="actionClass"
      :disabled="draft.lights.length >= 3"
      @click="
        draft.lights.push({
          position: 'front',
          color: '#ffffff',
          brightness: 60,
          diffusion: 60
        })
      "
    >
      {{ t('addLight') }}
    </button>
    <CinematicPresetSection
      v-model="draft"
      kind="lighting"
      :namespace
      :locale
    />
  </section>
</template>
