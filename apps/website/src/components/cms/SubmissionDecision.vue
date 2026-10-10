<script setup lang="ts">
import { Check, X } from '@lucide/vue'

import AdminButton from '@/components/cms/ui/AdminButton.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

/** Approve or reject one submitted workflow right from its row. */
const {
  title,
  canApply,
  locale = 'en'
} = defineProps<{
  title: string
  canApply: boolean
  locale?: Locale
}>()
const approved = defineModel<boolean>('approved', { required: true })
const emit = defineEmits<{ reject: [] }>()
const { t } = translationsFor(locale)
</script>

<template>
  <span
    v-if="!canApply"
    class="text-xs text-admin-muted"
    :class="approved && 'text-admin-success'"
  >
    {{
      approved
        ? t('cmsAdmin.decision.approved')
        : t('cmsAdmin.decision.undecided')
    }}
  </span>
  <template v-else-if="approved">
    <span
      class="inline-flex h-8 items-center gap-1.5 px-2 text-xs text-admin-success"
    >
      <Check class="size-4" aria-hidden="true" />
      {{ t('cmsAdmin.decision.approved') }}
    </span>
    <AdminButton variant="ghost" size="sm" @click="approved = false">
      {{ t('cmsAdmin.decision.undo') }}
    </AdminButton>
  </template>
  <template v-else>
    <AdminButton
      variant="ghost"
      size="icon"
      :aria-label="t('cmsAdmin.decision.rejectTitle', { title })"
      :title="t('cmsAdmin.review.reject')"
      class="hover:text-admin-danger-text"
      @click="emit('reject')"
    >
      <X class="size-4" />
    </AdminButton>
    <AdminButton
      :icon="Check"
      :aria-label="t('cmsAdmin.decision.approveTitle', { title })"
      @click="approved = true"
    >
      {{ t('cmsAdmin.decision.approve') }}
    </AdminButton>
  </template>
</template>
