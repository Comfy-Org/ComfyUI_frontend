<script setup lang="ts">
import { computed } from 'vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { CatalogPreviewChange } from '@/lib/cms/preview-display'
import { formatPreviewUtc, safeInternalPath } from '@/lib/cms/preview-display'
const { change, busy, locale } = defineProps<{
  change: CatalogPreviewChange
  busy: boolean
  locale: Locale
}>()
const emit = defineEmits<{ navigate: [route: string] }>()
const t = computed(() => translationsFor(locale).t)
function visit(route: string | undefined) {
  const path = safeInternalPath(route)
  if (!path || busy) return
  emit('navigate', path)
}
</script>
<template>
  <li class="rounded-lg border border-admin-line p-3">
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
      <span v-else class="text-sm font-medium">{{ change.title }}</span>
      <span
        class="rounded-sm border border-admin-field px-1.5 py-0.5 text-xs text-admin-muted"
        >{{ t(`cccPreview.${change.kind}`) }}</span
      >
    </div>
    <p class="mt-1 text-xs wrap-break-word text-admin-muted">
      {{ change.summary }}
    </p>
    <p
      v-if="change.visibleFrom && formatPreviewUtc(change.visibleFrom, locale)"
      class="mt-2 text-xs text-admin-muted"
    >
      {{
        t('cccPreview.launchAt', {
          at: formatPreviewUtc(change.visibleFrom, locale)
        })
      }}
    </p>
    <details v-if="change.fields?.length" class="mt-2 text-xs text-admin-muted">
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
</template>
