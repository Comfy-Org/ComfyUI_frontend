<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import { cn } from '@comfyorg/tailwind-utils'
import { ref } from 'vue'

import { t } from '../../i18n/translations'

const { transcript, locale = 'en' } = defineProps<{
  transcript: string
  locale?: Locale
}>()

const expanded = ref(false)
</script>

<template>
  <section
    class="px-4 py-8 lg:px-20 lg:py-12"
    :aria-label="t('demos.transcript.label', locale)"
  >
    <div class="mx-auto max-w-4xl">
      <button
        type="button"
        class="text-primary-comfy-canvas text-left"
        :aria-expanded="expanded"
        @click="expanded = !expanded"
      >
        <span class="text-sm font-semibold tracking-wide uppercase">
          {{ t('demos.transcript.label', locale) }}
        </span>
        <span class="text-primary-warm-gray ml-2 text-xs">
          {{ t('demos.transcript.note', locale) }}
        </span>
      </button>

      <div
        role="region"
        :aria-label="t('demos.transcript.label', locale)"
        :class="
          cn(
            expanded ? 'mt-4' : 'sr-only',
            'text-primary-warm-gray text-sm/relaxed'
          )
        "
        v-html="transcript"
      />
    </div>
  </section>
</template>
