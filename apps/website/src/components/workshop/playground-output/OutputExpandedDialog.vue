<script setup lang="ts">
import { X } from '@lucide/vue'
import { DialogContent, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'

import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import { MEDIA_CONTROL } from '@/components/workshop/playground-output/outputClasses'

const {
  url,
  alt,
  locale = 'en'
} = defineProps<{
  url: string
  alt?: string
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const open = defineModel<boolean>('open', { required: true })

defineEmits<{ restoreFocus: [] }>()
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogContent
        v-if="url"
        class="fixed inset-0 z-100 flex items-center justify-center bg-primary-comfy-ink/90 p-6 backdrop-blur-sm"
        :aria-describedby="undefined"
        data-testid="output-expanded"
        @click.self="open = false"
        @close-auto-focus.prevent="$emit('restoreFocus')"
      >
        <DialogTitle class="sr-only">{{
          t('workshop.output.title')
        }}</DialogTitle>
        <button
          type="button"
          :aria-label="t('workshop.output.collapse')"
          :class="cn(MEDIA_CONTROL, 'absolute top-6 right-6')"
          data-testid="output-collapse"
          @click="open = false"
        >
          <X class="size-4" aria-hidden="true" />
        </button>
        <img
          :src="url"
          :alt="alt ?? t('workshop.output.title')"
          class="max-h-full max-w-full rounded-2xl object-contain"
        />
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
