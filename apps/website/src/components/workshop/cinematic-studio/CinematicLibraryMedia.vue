<script setup lang="ts">
import type { Locale } from '../../../i18n/translations'
import type { SavedCreation } from '../../../lib/workshop/cinematic-studio/creations'
import { libraryCopy as copy } from '../../../lib/workshop/cinematic-studio/library-copy'
import Button from '../../ui/button/Button.vue'
const { item, url, hidden, locale } = defineProps<{
  item: SavedCreation
  url?: string
  hidden: boolean
  locale: Locale
}>()
const emit = defineEmits<{ reveal: [] }>()
</script>

<template>
  <div
    v-if="hidden"
    class="flex aspect-video flex-col items-center justify-center gap-3 bg-primary-comfy-ink text-sm text-primary-warm-white"
  >
    {{ copy('hidden', locale) }}
    <Button variant="outline" @click="emit('reveal')">{{
      copy('reveal', locale)
    }}</Button>
  </div>
  <img
    v-else-if="item.kind === 'image'"
    :src="url"
    :alt="item.name"
    loading="lazy"
    class="aspect-video w-full rounded-xl object-contain"
  />
  <video
    v-else
    :src="url"
    controls
    playsinline
    preload="none"
    :aria-label="item.name"
    class="aspect-video w-full rounded-xl"
  />
</template>
