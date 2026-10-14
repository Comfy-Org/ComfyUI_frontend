<script setup lang="ts">
import { Check, Clock, X } from '@lucide/vue'
import { cn } from '@comfyorg/tailwind-utils'

import AdminButton from '@/components/cms/ui/AdminButton.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

/** Tick every row shown, then decide the ticked rows in one go. */
const {
  count,
  shown,
  canReject = false,
  locale = 'en'
} = defineProps<{
  /** Rows ticked. */
  count: number
  /** Rows the filters show. */
  shown: number
  /** Only submitted workflows can be rejected. */
  canReject?: boolean
  locale?: Locale
}>()
const emit = defineEmits<{
  all: [checked: boolean]
  approve: []
  later: []
  reject: []
}>()
const { t } = translationsFor(locale)
</script>

<template>
  <div
    :class="
      cn(
        'sticky top-2 z-10 flex min-h-11 flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border px-4 py-1.5 text-xs transition-colors',
        count > 0
          ? 'border-admin-field bg-admin-card shadow-admin-popover'
          : 'border-transparent'
      )
    "
  >
    <label class="flex cursor-pointer items-center gap-2 text-admin-muted">
      <input
        type="checkbox"
        :checked="count > 0 && count === shown"
        :indeterminate="count > 0 && count < shown"
        class="size-4 cursor-pointer accent-admin-fg"
        @change="emit('all', ($event.target as HTMLInputElement).checked)"
      />
      <span v-if="count > 0" class="font-medium text-admin-fg">
        {{ t('cmsAdmin.bulk.selected', { count }) }}
      </span>
      <span v-else>{{ t('cmsAdmin.bulk.selectAll', { count: shown }) }}</span>
    </label>
    <div v-if="count > 0" class="ml-auto flex flex-wrap gap-1">
      <AdminButton
        v-if="canReject"
        variant="dangerGhost"
        :icon="X"
        @click="emit('reject')"
      >
        {{ t('cmsAdmin.review.reject') }}
      </AdminButton>
      <AdminButton variant="ghost" :icon="Clock" @click="emit('later')">
        {{ t('cmsAdmin.stage.later') }}
      </AdminButton>
      <AdminButton variant="primary" :icon="Check" @click="emit('approve')">
        {{ t('cmsAdmin.bulk.approve', { count }) }}
      </AdminButton>
    </div>
  </div>
</template>
