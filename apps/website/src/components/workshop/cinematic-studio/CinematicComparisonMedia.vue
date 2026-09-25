<script setup lang="ts">
import type { Locale } from '../../../i18n/translations'
import type { comparisonPanel } from './comparison-view'
import { tcComparison } from '../../../lib/workshop/cinematic-studio/comparison-copy'
import type { ComparisonCopyKey } from '../../../lib/workshop/cinematic-studio/comparison-copy'
import { comparisonCanShow } from '../../../lib/workshop/cinematic-studio/comparison'
import Button from '../../ui/button/Button.vue'
const { panel, locale, open, revealed, urls } = defineProps<{
  panel: ReturnType<typeof comparisonPanel>
  locale: Locale
  open: boolean
  revealed: readonly string[]
  urls: Readonly<Record<string, string>>
}>()
const emit = defineEmits<{ reveal: [string] }>()
const t = (key: ComparisonCopyKey) => tcComparison(key, locale)
</script>
<template>
  <div
    class="flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-primary-comfy-ink"
  >
    <template
      v-if="
        open && comparisonCanShow(panel.item, revealed, urls[panel.item.id])
      "
    >
      <img
        v-if="panel.item.kind === 'image'"
        :src="urls[panel.item.id]"
        :alt="panel.item.name"
        class="h-full w-full object-contain"
      />
      <video
        v-else
        :src="urls[panel.item.id]"
        :aria-label="`${t('video')}: ${panel.item.name}`"
        controls
        playsinline
        preload="metadata"
        class="h-full w-full object-contain"
      />
    </template>
    <div
      v-else-if="panel.item.nsfw && !revealed.includes(panel.item.id)"
      class="flex flex-col items-center gap-3 p-4 text-center"
    >
      <p class="text-sm">{{ t('hidden') }}</p>
      <Button
        variant="outline"
        size="sm"
        @click="emit('reveal', panel.item.id)"
        >{{ t('reveal') }}</Button
      >
    </div>
    <p v-else class="p-4 text-sm text-primary-comfy-canvas">
      {{ t('unavailable') }}
    </p>
  </div>
</template>
