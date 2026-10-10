<script setup lang="ts">
import { ArrowLeft, ExternalLink } from '@lucide/vue'

import AdminButton from '@/components/cms/ui/AdminButton.vue'
import StatusLabel from '@/components/cms/ui/StatusLabel.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

const {
  title,
  kindLabel,
  isNew,
  isLive,
  inDraft,
  deleted,
  previewHref,
  canSave,
  locale = 'en'
} = defineProps<{
  title: string
  kindLabel: string
  isNew: boolean
  isLive: boolean
  inDraft: boolean
  deleted: boolean
  previewHref?: string
  canSave: boolean
  locale?: Locale
}>()
const { t } = translationsFor(locale)
const state = deleted
  ? { tone: 'muted' as const, label: t('cmsAdmin.editor.archived') }
  : inDraft
    ? { tone: 'info' as const, label: t('cmsAdmin.content.inDraft') }
    : isLive
      ? { tone: 'success' as const, label: t('cmsAdmin.editor.live') }
      : undefined
</script>

<template>
  <a
    href="/admin/content/"
    class="inline-flex w-fit items-center gap-1.5 text-xs text-admin-muted hover:text-admin-fg"
  >
    <ArrowLeft class="size-3.5" aria-hidden="true" />
    {{ t('cmsAdmin.nav.content') }}
  </a>
  <header class="flex flex-wrap items-start justify-between gap-4">
    <div class="grid max-w-2xl min-w-0 gap-2">
      <h1
        class="text-admin-title leading-tight font-normal wrap-break-word text-admin-fg"
      >
        {{ title }}
      </h1>
      <p class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span class="text-admin-muted">{{ kindLabel }}</span>
        <StatusLabel
          v-if="isNew || !isLive"
          tone="success"
          :label="t('cmsAdmin.change.new')"
        />
        <StatusLabel v-if="state" :tone="state.tone" :label="state.label" />
      </p>
    </div>
    <div class="flex flex-wrap items-center gap-2">
      <AdminButton
        v-if="previewHref"
        :href="previewHref"
        target="_blank"
        :icon="ExternalLink"
      >
        {{ t('cmsAdmin.editor.previewPage') }}
      </AdminButton>
      <AdminButton type="submit" variant="primary" :disabled="!canSave">
        {{ t('cmsAdmin.editor.save') }}
      </AdminButton>
    </div>
  </header>
</template>
