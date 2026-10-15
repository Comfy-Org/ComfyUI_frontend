<script setup lang="ts">
import { History } from '@lucide/vue'
import { DialogDescription, DialogTitle } from 'reka-ui'
import { ref } from 'vue'

import EditorSection from '@/components/cms/editor/EditorSection.vue'
import AdminButton from '@/components/cms/ui/AdminButton.vue'
import AdminDialogContent from '@/components/cms/ui/AdminDialogContent.vue'
import StatusLabel from '@/components/cms/ui/StatusLabel.vue'
import Dialog from '@/components/ui/dialog/Dialog.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import { formatUtc } from '@/lib/cms/format'
import type { SaveResult } from '@/lib/cms/save-item'
import type { ItemVersion } from '@/lib/cms/versions'

/** Every save of this item; any earlier one can become the draft again. */
const {
  uid,
  versions,
  liveVersion,
  csrf,
  canEdit,
  locale = 'en'
} = defineProps<{
  uid: string
  versions: ItemVersion[]
  liveVersion?: string
  csrf: string
  canEdit: boolean
  locale?: Locale
}>()
const { t } = translationsFor(locale)
const picked = ref<ItemVersion>()
const busy = ref(false)
const failed = ref(false)

async function restore() {
  if (!picked.value) return
  busy.value = true
  failed.value = false
  const form = new FormData()
  form.set('csrf', csrf)
  form.set('action', 'restoreVersion')
  form.set('uid', uid)
  form.set('version', picked.value.editVersion)
  try {
    const response = await fetch('/admin/actions', {
      method: 'POST',
      body: form
    })
    if (((await response.json()) as SaveResult).ok) {
      window.location.assign(`/admin/edit/${uid}?notice=versionRestored`)
      return
    }
  } catch {
    // Reported below like a refused restore.
  }
  failed.value = true
  busy.value = false
}
</script>

<template>
  <EditorSection
    :title="t('cmsAdmin.versions.title')"
    :description="t('cmsAdmin.versions.help')"
  >
    <ol class="grid gap-1">
      <li
        v-for="(version, i) in versions"
        :key="version.editVersion"
        class="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-admin-hover"
      >
        <History
          class="size-3.5 shrink-0 text-admin-subtle"
          aria-hidden="true"
        />
        <span class="grid min-w-0 flex-1">
          <span class="truncate">{{ formatUtc(version.savedAt, locale) }}</span>
          <span class="truncate text-admin-muted">{{ version.savedBy }}</span>
        </span>
        <StatusLabel
          v-if="i === 0"
          tone="info"
          :label="t('cmsAdmin.versions.current')"
        />
        <StatusLabel
          v-if="version.editVersion === liveVersion"
          tone="success"
          :label="t('cmsAdmin.versions.live')"
        />
        <AdminButton
          v-if="i > 0 && canEdit"
          variant="ghost"
          size="sm"
          @click="picked = version"
        >
          {{ t('cmsAdmin.versions.restore') }}
        </AdminButton>
      </li>
    </ol>
  </EditorSection>
  <Dialog
    :open="picked !== undefined"
    @update:open="!$event && (picked = undefined)"
  >
    <AdminDialogContent :close-label="t('cmsAdmin.review.close')">
      <DialogTitle class="pr-8 text-base font-medium text-balance">
        {{
          t('cmsAdmin.versions.confirmTitle', {
            date: picked ? formatUtc(picked.savedAt, locale) : ''
          })
        }}
      </DialogTitle>
      <DialogDescription class="text-sm text-admin-muted">
        {{ t('cmsAdmin.versions.confirmBody') }}
      </DialogDescription>
      <p v-if="failed" role="alert" class="text-xs text-admin-danger-text">
        {{ t('cmsAdmin.undo.failed') }}
      </p>
      <div class="flex flex-wrap justify-end gap-2 pt-1">
        <AdminButton @click="picked = undefined">
          {{ t('cmsAdmin.publish.cancel') }}
        </AdminButton>
        <AdminButton variant="primary" :disabled="busy" @click="restore">
          {{ t('cmsAdmin.versions.restore') }}
        </AdminButton>
      </div>
    </AdminDialogContent>
  </Dialog>
</template>
