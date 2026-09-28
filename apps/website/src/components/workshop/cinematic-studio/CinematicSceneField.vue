<script setup lang="ts">
import type { Locale } from '../../../i18n/translations'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'
import CinematicEnhanceSwitch from './CinematicEnhanceSwitch.vue'

const { locale = 'en' } = defineProps<{
  locale?: Locale
}>()

const scene = defineModel<string>('scene', { required: true })
const enhance = defineModel<boolean>('enhance', { required: true })

const labelClass = 'text-xs font-medium text-primary-warm-gray'
</script>

<template>
  <section class="flex flex-col gap-2">
    <div class="flex items-center justify-between gap-3">
      <label for="cinematic-scene" :class="labelClass">
        {{ tc('cinematic.section.scene', locale) }}
      </label>
      <CinematicEnhanceSwitch v-model="enhance" :locale />
    </div>
    <textarea
      id="cinematic-scene"
      v-model="scene"
      rows="4"
      :placeholder="tc('cinematic.scene.placeholder', locale)"
      class="h-28 resize-none rounded-2xl border border-transparency-white-t20 bg-transparency-white-t4 px-3.5 py-3 text-sm leading-relaxed text-primary-warm-white outline-none placeholder:text-primary-warm-gray focus:border-primary-warm-white/60"
    />
  </section>
</template>
