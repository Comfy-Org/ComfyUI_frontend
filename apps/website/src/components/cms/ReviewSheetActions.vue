<script setup lang="ts">
import { Check, Plus, Trash2 } from '@lucide/vue'
import DeleteSubmissionButton from '@/components/cms/DeleteSubmissionButton.vue'
import UndoChangeButton from '@/components/cms/UndoChangeButton.vue'
import AdminButton from '@/components/cms/ui/AdminButton.vue'
import type { QueueItem } from '@/lib/cms/queue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
const { item, canEdit, canApply, selected, disabled, csrf, locale } =
  defineProps<{
    item: QueueItem
    canEdit: boolean
    canApply: boolean
    selected: boolean
    disabled: boolean
    csrf: string
    locale: Locale
  }>()
const emit = defineEmits<{ discard: []; select: [] }>()
const { t } = translationsFor(locale)
</script>
<template>
  <footer
    class="flex min-h-14 shrink-0 flex-wrap items-center gap-2 border-t border-admin-line px-5 py-3"
  >
    <AdminButton
      v-if="item.source === 'catalog' && item.canonical && canEdit"
      variant="dangerGhost"
      :icon="Trash2"
      :disabled
      @click="emit('discard')"
      >{{ t('cccStaging.deleteChanges') }}</AdminButton
    >
    <UndoChangeButton
      v-else-if="item.source === 'catalog' && canEdit"
      :key="item.id"
      :csrf
      :uid="item.id"
      :title="item.title"
      :published="item.change !== 'new'"
      destination="/admin/"
      :locale
    />
    <DeleteSubmissionButton
      v-else-if="item.source === 'submission' && canApply"
      :key="item.id"
      :item
      :csrf
      :locale
    />
    <span class="ml-auto flex flex-wrap items-center gap-1">
      <AdminButton
        v-if="canApply"
        :variant="selected ? 'secondary' : 'primary'"
        :icon="selected ? Check : Plus"
        :aria-pressed="selected"
        :disabled
        @click="emit('select')"
      >
        {{ selected ? t('cmsAdmin.review.picked') : t('cmsAdmin.review.pick') }}
      </AdminButton>
    </span>
  </footer>
</template>
