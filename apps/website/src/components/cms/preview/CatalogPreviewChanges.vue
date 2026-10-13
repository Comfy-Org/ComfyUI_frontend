<script setup lang="ts">
import { computed } from 'vue'
import {
  DialogRoot,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose
} from 'reka-ui'
import { X } from '@lucide/vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { CatalogPreviewChange } from '@/lib/cms/preview-display'
import CatalogPreviewChangeRow from './CatalogPreviewChangeRow.vue'

const open = defineModel<boolean>('open', { default: false })
const {
  changes,
  busy = false,
  locale = 'en'
} = defineProps<{
  changes: CatalogPreviewChange[]
  busy?: boolean
  locale?: Locale
}>()
const emit = defineEmits<{ navigate: [route: string] }>()
const t = computed(() => translationsFor(locale).t)
</script>
<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-60 bg-primary-comfy-ink/60" />
      <DialogContent
        class="fixed inset-y-0 right-0 z-60 flex w-full max-w-md flex-col border-l border-admin-line bg-admin-chrome font-admin text-admin-fg shadow-admin-drawer"
      >
        <header class="grid gap-2 border-b border-admin-line px-5 py-5 pr-14">
          <DialogTitle class="text-lg font-medium">{{
            t('cccPreview.changesTitle')
          }}</DialogTitle>
          <DialogDescription class="text-xs text-admin-muted">{{
            t('cccPreview.changesDescription')
          }}</DialogDescription>
          <DialogClose
            :aria-label="t('cccPreview.close')"
            class="absolute top-5 right-4 rounded-lg p-1.5 text-admin-muted hover:bg-admin-hover focus-visible:outline-2 focus-visible:outline-admin-fg"
            ><X class="size-4" aria-hidden="true"
          /></DialogClose>
        </header>
        <div class="min-h-0 flex-1 overflow-y-auto p-3">
          <p v-if="!changes.length" class="p-3 text-sm text-admin-muted">
            {{ t('cccPreview.empty') }}
          </p>
          <ul v-else class="grid gap-1">
            <CatalogPreviewChangeRow
              v-for="change in changes"
              :key="change.uid"
              :change
              :busy
              :locale
              @navigate="emit('navigate', $event)"
            />
          </ul>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
