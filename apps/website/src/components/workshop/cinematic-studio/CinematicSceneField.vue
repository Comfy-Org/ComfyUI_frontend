<script setup lang="ts">
import type { Locale } from '../../../i18n/translations'
import { translationsFor } from '../../../i18n/translations'
import CinematicEnhanceSwitch from './CinematicEnhanceSwitch.vue'

const { video = false, locale = 'en' } = defineProps<{
  /** A video shot's enhance line describes motion, not a still. */
  video?: boolean
  locale?: Locale
}>()
const { t: tc } = translationsFor(locale)

const scene = defineModel<string>('scene', { required: true })
const enhance = defineModel<boolean>('enhance', { required: true })
</script>

<template>
  <section class="flex flex-col">
    <label for="cinematic-scene" class="sr-only">
      {{ tc('cinematic.section.scene') }}
    </label>
    <div
      class="flex flex-col overflow-hidden rounded-2xl border border-transparency-white-t20 bg-transparency-white-t4 focus-within:border-primary-warm-white/60"
    >
      <textarea
        id="cinematic-scene"
        v-model="scene"
        rows="4"
        :placeholder="tc('cinematic.scene.placeholder')"
        class="h-28 resize-none bg-transparent px-3.5 py-3 text-sm leading-relaxed text-primary-warm-white outline-none placeholder:text-primary-warm-gray"
      />
      <div class="flex items-center justify-between gap-3 pr-4 pb-2.5 pl-2.5">
        <slot />
        <CinematicEnhanceSwitch v-model="enhance" :video :locale />
      </div>
    </div>
  </section>
</template>
