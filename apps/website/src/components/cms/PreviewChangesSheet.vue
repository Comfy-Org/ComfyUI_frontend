<script setup lang="ts">
import { DialogDescription, DialogTitle } from 'reka-ui'

import ChangeTag from '@/components/cms/ChangeTag.vue'
import PreviewForm from '@/components/cms/PreviewForm.vue'
import AdminSheetContent from '@/components/cms/ui/AdminSheetContent.vue'
import { adminButtonVariants } from '@/components/cms/ui/adminButton'
import Sheet from '@/components/ui/sheet/Sheet.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { PreviewChange } from '@/lib/cms/format'

const {
  csrf,
  changes,
  pathname,
  locale = 'en'
} = defineProps<{
  csrf: string
  changes: PreviewChange[]
  pathname: string
  locale?: Locale
}>()
const open = defineModel<boolean>('open', { required: true })
const { t } = translationsFor(locale)
const link =
  'grid w-full cursor-pointer gap-1 rounded-lg px-3 py-2 text-left text-sm hover:bg-admin-hover aria-[current=page]:bg-admin-line'

// Focus the panel itself so no list entry looks selected on open.
function focusPanel(event: Event) {
  event.preventDefault()
  if (event.target instanceof HTMLElement) event.target.focus()
}
</script>

<template>
  <Sheet v-model:open="open">
    <AdminSheetContent
      :close-label="t('cmsAdmin.review.close')"
      class="outline-none sm:max-w-sm"
      @open-auto-focus="focusPanel"
    >
      <div class="grid gap-1 border-b border-admin-line p-5 pr-14">
        <DialogTitle class="text-base font-medium">
          {{ t('cmsAdmin.preview.changesTitle') }}
        </DialogTitle>
        <DialogDescription class="text-xs text-admin-muted">
          {{ t('cmsAdmin.preview.changesNote') }}
        </DialogDescription>
      </div>
      <ul class="grid content-start gap-0.5 overflow-y-auto p-2">
        <li v-for="change in changes" :key="change.id">
          <PreviewForm
            v-if="change.launch"
            :csrf
            action="preview"
            view="DRAFT"
            :now="change.launch"
            :return-to="change.page"
          >
            <button :class="link">
              <span>{{ change.title }}</span>
              <span class="flex items-center gap-3 text-xs text-admin-warning">
                <ChangeTag :change="change.change" :locale />
                {{ change.detail }}
              </span>
            </button>
          </PreviewForm>
          <a
            v-else
            :href="change.page"
            :aria-current="change.page === pathname ? 'page' : undefined"
            :class="link"
          >
            <span>{{ change.title }}</span>
            <span class="flex items-center gap-3 text-xs text-admin-muted">
              <ChangeTag :change="change.change" :locale />
              {{ change.detail }}
            </span>
          </a>
        </li>
      </ul>
      <div class="mt-auto border-t border-admin-line p-3">
        <a href="/admin/" :class="adminButtonVariants({ class: 'w-full' })">
          {{ t('cmsAdmin.preview.toAdmin') }}
        </a>
      </div>
    </AdminSheetContent>
  </Sheet>
</template>
