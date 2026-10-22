<script setup lang="ts">
import { translationsFor } from '@/i18n/translations'
import type { Locale } from '@/i18n/translations'
const { deleted, state, dirty, errors, locale } = defineProps<{
  deleted?: boolean
  state: string
  dirty: boolean
  errors: string[]
  locale: Locale
}>()
const { t } = translationsFor(locale)
</script>
<template>
  <p
    v-if="deleted"
    role="status"
    class="rounded-xl border border-admin-danger/30 bg-admin-danger/10 p-4 text-sm text-admin-danger-text"
  >
    {{ t('cccEditorDelete.deleted') }}
  </p>
  <p
    v-if="state === 'saved' && !dirty"
    role="status"
    class="rounded-lg border border-admin-success/30 bg-admin-success/10 p-3 text-sm"
  >
    {{ t('cmsEditor.saved') }}
  </p>
  <div
    v-if="errors.length"
    role="alert"
    class="rounded-lg border border-admin-danger/30 p-4 text-sm text-admin-danger-text"
  >
    <p v-for="error in errors" :key="error">{{ error }}</p>
    <p v-if="state === 'conflict'" class="mt-2 text-admin-muted">
      {{ t('cmsEditor.keepEdits') }}
    </p>
  </div>
</template>
