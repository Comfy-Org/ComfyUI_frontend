<script setup lang="ts">
import { useResizeObserver } from '@vueuse/core'
import { onMounted, ref, useId, useTemplateRef } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

// Two lines of the description, and the rest behind a word. A model's lead and
// a workflow's are both written long, and at full length they push the page's
// own tabs below the fold before the reader has decided whether to stay.
const { text, locale = 'en' } = defineProps<{
  text: string
  locale?: Locale
}>()

const id = useId()
const paragraph = useTemplateRef<HTMLParagraphElement>('paragraph')
const opened = ref(false)
const overflows = ref(false)

const measure = () => {
  const el = paragraph.value
  overflows.value = !!el && el.scrollHeight > el.clientHeight
}

onMounted(measure)
useResizeObserver(paragraph, () => {
  if (!opened.value) measure()
})
</script>

<template>
  <div class="flex flex-col items-start gap-1">
    <p
      :id
      ref="paragraph"
      :class="
        cn('text-sm/relaxed text-primary-warm-gray', !opened && 'line-clamp-2')
      "
    >
      {{ text }}
    </p>
    <button
      v-if="overflows || opened"
      type="button"
      :aria-expanded="opened"
      :aria-controls="id"
      class="cursor-pointer text-sm font-medium text-primary-comfy-canvas underline-offset-4 transition-colors hover:text-primary-comfy-yellow hover:underline focus-visible:outline-primary-comfy-yellow"
      data-testid="hub-header-summary-toggle"
      @click="opened = !opened"
    >
      {{ t(opened ? 'ui.readLess' : 'ui.readMore', locale) }}
    </button>
  </div>
</template>
