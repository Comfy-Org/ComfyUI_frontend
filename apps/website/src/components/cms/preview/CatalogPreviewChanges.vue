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
import { formatPreviewUtc, safeInternalPath } from '@/lib/cms/preview-display'

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
function visit(route: string | undefined) {
  const path = safeInternalPath(route)
  if (!path || busy) return
  emit('navigate', path)
  // The caller owns navigation and errors; do not claim it succeeded here.
}
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
            <li
              v-for="change in changes"
              :key="change.uid"
              class="rounded-lg border border-admin-line p-3"
            >
              <div class="flex items-start justify-between gap-2">
                <button
                  v-if="safeInternalPath(change.route)"
                  type="button"
                  :disabled="busy"
                  class="text-left text-sm font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-admin-fg disabled:opacity-40"
                  @click="visit(change.route)"
                >
                  {{ change.title }}
                </button>
                <span v-else class="text-sm font-medium">{{
                  change.title
                }}</span>
                <span
                  class="rounded-sm border border-admin-field px-1.5 py-0.5 text-xs text-admin-muted"
                  >{{ t(`cccPreview.${change.kind}`) }}</span
                >
              </div>
              <p class="mt-1 text-xs wrap-break-word text-admin-muted">
                {{ change.summary }}
              </p>
              <p
                v-if="
                  change.visibleFrom &&
                  formatPreviewUtc(change.visibleFrom, locale)
                "
                class="mt-2 text-xs text-admin-muted"
              >
                {{
                  t('cccPreview.launchAt', {
                    at: formatPreviewUtc(change.visibleFrom, locale)
                  })
                }}
              </p>
              <details
                v-if="change.fields?.length"
                class="mt-2 text-xs text-admin-muted"
              >
                <summary class="cursor-pointer">
                  {{ t('cccPreview.fields') }}
                </summary>
                <ul class="mt-2 grid gap-1">
                  <li v-for="field in change.fields" :key="field">
                    <code class="break-all">{{ field }}</code>
                  </li>
                </ul>
              </details>
              <code class="mt-2 block text-xs break-all text-admin-subtle">{{
                change.uid
              }}</code>
            </li>
          </ul>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
