<script setup lang="ts">
import type { Locale } from '../../../i18n/translations'
import { tcBuilder } from '../../../lib/workshop/cinematic-studio/builder-copy'
import Button from '../../ui/button/Button.vue'
import type { SavedCreation } from '../../../lib/workshop/cinematic-studio/creations'
import type { plannedShotTakes } from '../../../lib/workshop/cinematic-studio/scene-builder'
const { take, urls, locale } = defineProps<{
  take: ReturnType<typeof plannedShotTakes>[number]
  urls: Readonly<Record<string, string>>
  locale: Locale
}>()
const revealed = defineModel<string[]>('revealed', { required: true })
const emit = defineEmits<{
  useTake: [action: 'view' | 'edit' | 'animate', creation: SavedCreation]
}>()
function isHidden(item: SavedCreation) {
  return item.nsfw && !revealed.value.includes(item.id)
}
function hasImage(item: SavedCreation) {
  return urls[item.id] && item.kind === 'image'
}
const t = (key: Parameters<typeof tcBuilder>[0]) => tcBuilder(key, locale)
</script>
<template>
  <div
    class="mt-3 flex min-w-0 flex-col gap-2 rounded-lg border border-transparency-white-t8 p-2"
  >
    <p class="text-xs text-primary-comfy-canvas">
      {{ take.previousVersion ? t('previousVersion') : t('currentVersion') }}
    </p>
    <template v-if="isHidden(take.creation)">
      <p>{{ t('sensitive') }}</p>
      <Button
        variant="outline"
        @click="revealed = [...revealed, take.creation.id]"
        >{{ t('reveal') }}</Button
      >
    </template>
    <template v-else>
      <img
        v-if="hasImage(take.creation)"
        :src="urls[take.creation.id]"
        :alt="take.creation.name"
        class="max-h-48 w-full rounded-lg object-contain"
      />
      <video
        v-else-if="urls[take.creation.id]"
        :src="urls[take.creation.id]"
        controls
        preload="metadata"
        class="max-h-48 w-full rounded-lg"
      />
      <p class="truncate">{{ take.creation.name }}</p>
      <p
        v-if="!urls[take.creation.id]"
        class="text-xs text-primary-comfy-canvas"
      >
        {{ t('mediaUnavailable') }}
      </p>
      <div class="flex flex-wrap gap-2">
        <Button
          variant="outline"
          :disabled="!urls[take.creation.id]"
          @click="emit('useTake', 'view', take.creation)"
          >{{ t('viewTake') }}</Button
        >
        <template v-if="take.creation.kind === 'image'">
          <Button
            variant="outline"
            :disabled="!urls[take.creation.id]"
            @click="emit('useTake', 'edit', take.creation)"
            >{{ t('editTake') }}</Button
          >
          <Button
            variant="outline"
            :disabled="!urls[take.creation.id]"
            @click="emit('useTake', 'animate', take.creation)"
            >{{ t('animateTake') }}</Button
          >
        </template>
      </div>
    </template>
  </div>
</template>
