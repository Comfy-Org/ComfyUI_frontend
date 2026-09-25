<script setup lang="ts">
import type { Locale } from '../../../i18n/translations'
import { tcBuilder } from '../../../lib/workshop/cinematic-studio/builder-copy'
import CinematicPlannedTakeCard from './CinematicPlannedTakeCard.vue'
import type { SavedCreation } from '../../../lib/workshop/cinematic-studio/creations'
import type { plannedShotTakes } from '../../../lib/workshop/cinematic-studio/scene-builder'
const { takes, urls, locale } = defineProps<{
  takes: ReturnType<typeof plannedShotTakes>
  urls: Readonly<Record<string, string>>
  locale: Locale
}>()
const revealed = defineModel<string[]>('revealed', { required: true })
const emit = defineEmits<{
  useTake: [action: 'view' | 'edit' | 'animate', creation: SavedCreation]
}>()
const t = (key: Parameters<typeof tcBuilder>[0]) => tcBuilder(key, locale)
</script>
<template>
  <details
    v-if="takes.length"
    class="border-t border-transparency-white-t8 pt-3 text-sm text-primary-warm-white"
  >
    <summary class="cursor-pointer">
      {{ t('takes') }} · {{ takes.length }}
    </summary>
    <CinematicPlannedTakeCard
      v-for="take in takes"
      :key="take.creation.id"
      v-model:revealed="revealed"
      :take
      :urls
      :locale
      @use-take="(action, creation) => emit('useTake', action, creation)"
    />
  </details>
</template>
