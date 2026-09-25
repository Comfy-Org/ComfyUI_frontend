<script setup lang="ts">
import type { Locale } from '../../../i18n/translations'
import type { ModelResult } from '../../../lib/workshop/cinematic-studio/model-results'
import { tcModelResults } from '../../../lib/workshop/cinematic-studio/model-results-copy'
import Button from '../../ui/button/Button.vue'
const { output, url, locale } = defineProps<{
  output: ModelResult['outputs'][number]
  url?: string
  locale: Locale
}>()
const revealed = defineModel<boolean>('revealed', { required: true })
const emit = defineEmits<{
  animate: [url: string, name: string]
  edit: [url: string, name: string]
}>()
const t = (key: Parameters<typeof tcModelResults>[0]) =>
  tcModelResults(key, locale)
</script>

<template>
  <div class="my-3">
    <template v-if="output.nsfw && !revealed">
      <p class="my-3 text-sm">{{ t('hidden') }}</p>
      <Button variant="outline" @click="revealed = true">{{
        t('reveal')
      }}</Button>
    </template>
    <template v-else>
      <img
        v-if="output.kind === 'image'"
        :src="url"
        :alt="output.fileName"
        loading="lazy"
        class="aspect-video w-full rounded-lg object-contain"
      />
      <video
        v-else-if="output.kind === 'video'"
        :src="url"
        :aria-label="output.fileName"
        controls
        playsinline
        preload="none"
        class="aspect-video w-full rounded-lg"
      />
      <audio
        v-else-if="output.kind === 'audio'"
        :src="url"
        :aria-label="output.fileName"
        controls
        preload="none"
        class="w-full"
      />
      <p v-else class="py-4 text-sm">{{ t('file') }} · {{ t(output.kind) }}</p>
      <p class="my-2 text-xs wrap-break-word">{{ output.fileName }}</p>
      <div class="flex flex-wrap gap-2">
        <a
          :href="url"
          :download="output.fileName"
          class="rounded-lg border border-transparency-white-t20 px-3 py-2 text-sm"
          >{{ t('download') }}</a
        >
        <template v-if="output.kind === 'image' && url">
          <Button
            variant="outline"
            size="sm"
            @click="emit('animate', url, output.fileName)"
            >{{ t('animate') }}</Button
          >
          <Button
            variant="outline"
            size="sm"
            @click="emit('edit', url, output.fileName)"
            >{{ t('edit') }}</Button
          >
        </template>
      </div>
    </template>
  </div>
</template>
