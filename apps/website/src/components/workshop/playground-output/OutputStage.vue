<script setup lang="ts">
import { Maximize2 } from '@lucide/vue'
import { useTemplateRef } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import OutputTransport from '@/components/workshop/OutputTransport.vue'
import type { RunOutput } from '@/config/workshop-run'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import OutputMediaBody from '@/components/workshop/playground-output/OutputMediaBody.vue'
import { MEDIA_CONTROL } from '@/components/workshop/playground-output/outputClasses'

const {
  shown,
  url,
  blurred,
  expandable,
  example,
  compact,
  locale = 'en'
} = defineProps<{
  shown: RunOutput
  url: string
  blurred: boolean
  expandable: boolean
  example: boolean
  compact: boolean
  locale?: Locale
}>()
const { t } = translationsFor(locale)

defineEmits<{
  delivery: [url: string, status: 'succeeded' | 'failed' | 'cancelled']
  playbackStarted: [url: string]
  expand: []
  reveal: []
}>()

const expandTrigger = useTemplateRef<HTMLButtonElement>('expandTrigger')
defineExpose({ focusExpand: () => expandTrigger.value?.focus() })
</script>

<template>
  <div
    :class="
      cn(
        'relative w-full overflow-hidden bg-black/20',
        compact
          ? 'h-72 shrink-0 sm:h-80 lg:h-100'
          : 'aspect-video max-h-[70dvh] flex-1'
      )
    "
    data-testid="output-media"
  >
    <OutputMediaBody
      :key="url"
      :shown
      :url
      :blurred
      :locale
      @delivery="
        (deliveredUrl, status) => $emit('delivery', deliveredUrl, status)
      "
    />
    <!-- Saying "example" three times over one video says it less, so it
      is marked once, on the result. -->
    <span
      v-if="example"
      class="absolute top-3 right-3 z-20 inline-flex h-6 items-center rounded-lg bg-black/40 px-2 text-2xs font-bold tracking-wider text-white uppercase backdrop-blur-md"
      data-testid="output-example"
    >
      {{ t('workshop.output.example') }}
    </span>

    <template v-if="url && !blurred">
      <button
        v-if="expandable"
        ref="expandTrigger"
        type="button"
        :aria-label="t('workshop.output.expand')"
        :class="cn(MEDIA_CONTROL, 'absolute right-3 bottom-3')"
        data-testid="output-expand"
        @click="$emit('expand')"
      >
        <Maximize2 class="size-4" aria-hidden="true" />
      </button>

      <OutputTransport
        v-if="shown.kind === 'audio'"
        :src="url"
        :locale
        class="absolute inset-x-0 bottom-0"
        @loaded="$emit('delivery', $event, 'succeeded')"
        @failed="$emit('delivery', $event, 'failed')"
        @playback-started="$emit('playbackStarted', $event)"
        @cancelled="$emit('delivery', $event, 'cancelled')"
      />
    </template>
    <button
      v-if="blurred"
      type="button"
      class="absolute inset-0 flex cursor-pointer flex-col items-center justify-center gap-2 text-center"
      data-testid="output-reveal"
      @click="$emit('reveal')"
    >
      <span class="text-sm text-primary-warm-white">
        {{ t('workshop.output.nsfw') }}
      </span>
      <span
        class="text-xs font-bold tracking-wider text-primary-comfy-yellow uppercase"
      >
        {{ t('workshop.output.reveal') }}
      </span>
    </button>
  </div>
</template>
