<script setup lang="ts">
import { Upload } from '@lucide/vue'
import { cn } from '@comfyorg/tailwind-utils'

import AdminButton from '@/components/cms/ui/AdminButton.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

/** Tick the rows to publish, then publish them in one go. */
const {
  count,
  shown,
  shownPicked,
  locale = 'en'
} = defineProps<{
  /** Rows ticked, including any the filters hide. */
  count: number
  /** Rows the filters show. */
  shown: number
  /** Ticked rows among those shown. */
  shownPicked: number
  locale?: Locale
}>()
const emit = defineEmits<{ all: [checked: boolean]; publish: [] }>()
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
        :checked="shownPicked > 0 && shownPicked === shown"
        :indeterminate="shownPicked > 0 && shownPicked < shown"
        class="size-4 cursor-pointer accent-admin-fg"
        @change="emit('all', ($event.target as HTMLInputElement).checked)"
      />
      <span v-if="count > 0" class="font-medium text-admin-fg">
        {{ t('cmsAdmin.bulk.selected', { count }) }}
      </span>
      <span v-else>{{ t('cmsAdmin.bulk.selectAll', { count: shown }) }}</span>
    </label>
    <AdminButton
      variant="primary"
      :icon="Upload"
      :disabled="count === 0"
      class="ml-auto"
      @click="emit('publish')"
    >
      {{ t('cmsAdmin.bulk.publish', { count }, count) }}
    </AdminButton>
  </div>
</template>
