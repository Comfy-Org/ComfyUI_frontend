<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { DialogRoot, DialogTitle, DialogDescription } from 'reka-ui'
import AdminDialogContent from '@/components/cms/ui/AdminDialogContent.vue'
import AdminButton from '@/components/cms/ui/AdminButton.vue'
import CatalogChangeRow from './CatalogChangeRow.vue'
import CatalogPublish from './CatalogPublish.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { FinalReview } from '@/lib/cms/staging-review'

const {
  review,
  csrf,
  returnFocus,
  selectedUids,
  locale = 'en'
} = defineProps<{
  review: FinalReview
  csrf: string
  locale?: Locale
  returnFocus?: HTMLElement
  selectedUids?: string[]
}>()
const emit = defineEmits<{ close: [] }>()
const { t } = translationsFor(locale)
const publishing = ref(false)
function close() {
  if (!publishing.value) emit('close')
}
async function restoreFocus(event: Event) {
  event.preventDefault()
  await nextTick()
  returnFocus?.focus()
}
</script>

<template>
  <DialogRoot
    :open="true"
    @update:open="
      (open) => {
        if (!open) close()
      }
    "
  >
    <AdminDialogContent
      :close-label="t('cccStaging.close')"
      :close-disabled="publishing"
      class="sm:max-w-4xl"
      @close-auto-focus="restoreFocus"
    >
      <DialogTitle class="pr-8 text-base font-medium text-balance">
        {{ t('cccStaging.finalReview') }}
      </DialogTitle>
      <DialogDescription class="text-sm text-admin-muted">
        {{ t('cccStaging.matches', { count: review.changes.length }) }}
      </DialogDescription>
      <ul
        :aria-label="t('cccStaging.changes')"
        class="rounded-xl border border-admin-line bg-admin-chrome"
      >
        <CatalogChangeRow
          v-for="item in review.changes"
          :key="item.content.uid"
          :item="item"
          :checkbox-only="Boolean(selectedUids)"
          :draft-rev="review.state.draft_rev"
          :locale
        />
      </ul>
      <template v-if="review.deferred.length">
        <h2 class="text-sm font-medium">
          {{ t(selectedUids ? 'cccChecked.remaining' : 'cccStaging.deferred') }}
        </h2>
        <ul
          :aria-label="
            t(selectedUids ? 'cccChecked.remaining' : 'cccStaging.deferred')
          "
          class="rounded-xl border border-admin-line bg-admin-chrome"
        >
          <CatalogChangeRow
            v-for="item in review.deferred"
            :key="item.content.uid"
            :item="item"
            :draft-rev="review.state.draft_rev"
            :locale
            :checkbox-only="Boolean(selectedUids)"
          />
        </ul>
      </template>
      <CatalogPublish
        :key="review.selection_digest"
        :review
        :csrf
        :selected-uids="selectedUids"
        :locale
        @busy="publishing = $event"
      />
      <AdminButton :disabled="publishing" @click="close">{{
        t('cccStaging.back')
      }}</AdminButton>
    </AdminDialogContent>
  </DialogRoot>
</template>
