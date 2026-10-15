<script setup lang="ts">
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { SaveNotice } from '@/lib/cms/save-client'
import type { SaveError } from '@/lib/cms/save-item'

/** The editor's messages: what the last save did, read-only access, a failed save. */
const {
  notice,
  previewHref,
  readOnly,
  error,
  locale = 'en'
} = defineProps<{
  notice?: SaveNotice
  previewHref?: string
  readOnly: boolean
  error?: SaveError
  locale?: Locale
}>()
const { t } = translationsFor(locale)
</script>

<template>
  <p
    v-if="notice"
    role="status"
    class="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-admin-success/25 bg-admin-success/10 px-3 py-2 text-xs"
  >
    <span class="mr-auto">{{ t(`cmsAdmin.editor.notice.${notice}`) }}</span>
    <a
      v-if="previewHref"
      :href="previewHref"
      target="_blank"
      rel="noopener"
      class="font-medium underline-offset-2 hover:underline"
    >
      {{ t('cmsAdmin.editor.previewSaved') }}
    </a>
    <a href="/admin/" class="font-medium underline-offset-2 hover:underline">
      {{ t('cmsAdmin.editor.goToDraft') }}
    </a>
  </p>
  <p
    v-if="readOnly"
    class="rounded-lg border border-admin-info/25 bg-admin-info/10 px-3 py-2 text-xs"
  >
    {{ t('cmsAdmin.editor.readOnly') }}
  </p>
  <p
    v-if="error"
    role="alert"
    class="rounded-lg border border-admin-danger/30 bg-admin-danger/10 px-3 py-2 text-xs text-admin-danger-text"
  >
    {{ t(`cmsAdmin.editor.error.${error}`) }}
  </p>
</template>
