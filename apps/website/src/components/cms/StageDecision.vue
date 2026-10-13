<script setup lang="ts">
import { Check, Clock, RotateCcw, X } from '@lucide/vue'
import { cn } from '@comfyorg/tailwind-utils'

import AdminButton from '@/components/cms/ui/AdminButton.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { StageStatus } from '@/lib/cms/stage-status'

/** Approve a change, leave it for later, or (for a workflow) reject it. */
const {
  status,
  title,
  canApply,
  canReject = false,
  locale = 'en'
} = defineProps<{
  status: StageStatus
  title: string
  canApply: boolean
  /** Only submitted workflows can be rejected outright. */
  canReject?: boolean
  locale?: Locale
}>()
const emit = defineEmits<{ decide: [status: StageStatus]; reject: [] }>()
const { t } = translationsFor(locale)
</script>

<template>
  <span v-if="!canApply" class="text-xs text-admin-muted">
    {{ t(`cmsAdmin.stage.label.${status}`) }}
  </span>
  <template v-else-if="status === 'NEW'">
    <AdminButton
      v-if="canReject"
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
      variant="ghost"
      :icon="Clock"
      :aria-label="t('cmsAdmin.stage.laterTitle', { title })"
      @click="emit('decide', 'DEFERRED')"
    >
      {{ t('cmsAdmin.stage.later') }}
    </AdminButton>
    <AdminButton
      :icon="Check"
      :aria-label="t('cmsAdmin.decision.approveTitle', { title })"
      @click="emit('decide', 'APPROVED')"
    >
      {{ t('cmsAdmin.decision.approve') }}
    </AdminButton>
  </template>
  <template v-else>
    <span
      :class="
        cn(
          'inline-flex h-8 items-center gap-1.5 px-2 text-xs',
          status === 'APPROVED' ? 'text-admin-success' : 'text-admin-muted'
        )
      "
    >
      <Check v-if="status === 'APPROVED'" class="size-4" aria-hidden="true" />
      <Clock v-else class="size-4" aria-hidden="true" />
      {{ t(`cmsAdmin.stage.label.${status}`) }}
    </span>
    <AdminButton
      variant="ghost"
      :icon="RotateCcw"
      :aria-label="t('cmsAdmin.stage.backTitle', { title })"
      @click="emit('decide', 'NEW')"
    >
      {{ t('cmsAdmin.stage.back') }}
    </AdminButton>
  </template>
</template>
