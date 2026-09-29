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
    <label for="cinematic-scene" :class="labelClass">
      {{ tc('cinematic.section.scene', locale) }}
    </label>
    <div
      class="flex flex-col overflow-hidden rounded-2xl border border-transparency-white-t20 bg-transparency-white-t4 focus-within:border-primary-warm-white/60"
    >
      <textarea
        id="cinematic-scene"
        v-model="scene"
        rows="4"
        :placeholder="tc('cinematic.scene.placeholder', locale)"
        class="h-28 resize-none bg-transparent px-3.5 py-3 text-sm leading-relaxed text-primary-warm-white outline-none placeholder:text-primary-warm-gray"
      />
      <div class="border-t border-transparency-white-t8 px-3.5 py-2.5">
        <CinematicEnhanceSwitch v-model="enhance" :locale />
      </div>
    </div>
  </section>
</template>
