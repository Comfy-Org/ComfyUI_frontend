<script setup lang="ts">
import { ref } from 'vue'
import type { ComponentProps } from 'vue-component-type-helpers'
import CatalogAdminShell from '@/components/cms/layout/CatalogAdminShell.vue'
import ContentEditor from './ContentEditor.vue'
import { updateCatalogPreview } from '@/lib/cms/preview-client'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

const {
  editor,
  liveRevision,
  locale = 'en'
} = defineProps<{
  editor: ComponentProps<typeof ContentEditor>
  liveRevision: number
  locale?: Locale
}>()
const { t } = translationsFor(locale)
const exiting = ref(false)
const failed = ref(false)
async function openLive() {
  if (exiting.value) return
  exiting.value = true
  failed.value = !(await updateCatalogPreview(
    { view: 'LIVE', now: 'now' },
    editor.csrf
  ))
  if (!failed.value) window.location.assign('/hub/models/')
  else exiting.value = false
}
</script>

<template>
  <CatalogAdminShell
    current="content"
    :navigation="[{ key: 'draft', href: '/admin/catalog' }]"
    :live-revision="liveRevision"
    :busy="exiting"
    :locale
    @open-live="openLive"
  >
    <p v-if="failed" role="alert" class="mb-4 text-sm text-admin-danger-text">
      {{ t('cccPreview.updateFailed') }}
    </p>
    <ContentEditor v-bind="editor" :locale sidebar />
  </CatalogAdminShell>
</template>
