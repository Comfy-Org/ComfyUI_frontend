<script setup lang="ts">
import { File as FileIcon } from '@lucide/vue'

import { cn } from '@comfyorg/tailwind-utils'

import VideoPlayer from '@/components/common/VideoPlayer.vue'
import type { RunOutput } from '@/config/workshop-run'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

const {
  shown,
  url,
  blurred,
  locale = 'en'
} = defineProps<{
  shown: RunOutput
  url: string
  blurred: boolean
  locale?: Locale
}>()
const { t } = translationsFor(locale)

defineEmits<{
  delivery: [url: string, status: 'succeeded' | 'failed']
}>()
</script>

<template>
  <div
    :class="
      cn(
        'size-full animate-soft-in transition-all',
        blurred && 'blur-2xl select-none'
      )
    "
  >
    <VideoPlayer
      v-if="url && shown.kind === 'video' && !blurred"
      :src="url"
      :locale
      :aria-label="shown.alt ?? t('workshop.output.title')"
      class="size-full rounded-none border-0"
      fit="contain"
      controls-on-hover
      autoplay
      loop
      no-cors
      @loaded="$emit('delivery', $event, 'succeeded')"
      @failed="$emit('delivery', $event, 'failed')"
    />
    <img
      v-else-if="url && shown.kind === 'image' && !blurred"
      :src="url"
      :alt="shown.alt ?? t('workshop.output.title')"
      class="size-full object-contain"
      fetchpriority="high"
      @load="$emit('delivery', url, 'succeeded')"
      @error="$emit('delivery', url, 'failed')"
    />
    <pre
      v-else-if="shown.kind === 'text' && !blurred"
      class="size-full overflow-y-auto p-5 font-mono text-sm whitespace-pre-wrap text-primary-warm-white"
      >{{ shown.text }}</pre>
    <div
      v-else-if="shown.kind === 'audio'"
      class="flex size-full items-end justify-center gap-1 p-8"
      aria-hidden="true"
    >
      <span
        v-for="bar in 32"
        :key="bar"
        class="w-1.5 rounded-full bg-primary-comfy-yellow/70"
        :style="{ height: `${20 + ((bar * 37) % 60)}%` }"
      />
    </div>
    <div
      v-else
      class="flex size-full flex-col items-center justify-center gap-3 p-8 text-primary-warm-gray"
    >
      <FileIcon class="size-12" aria-hidden="true" />
      <span>{{ shown.fileName }}</span>
    </div>
  </div>
</template>
