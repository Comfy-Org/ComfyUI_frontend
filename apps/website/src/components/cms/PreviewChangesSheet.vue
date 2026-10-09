<script setup lang="ts">
import ChangeTag from '@/components/cms/ChangeTag.vue'
import PreviewForm from '@/components/cms/PreviewForm.vue'
import Sheet from '@/components/ui/sheet/Sheet.vue'
import SheetContent from '@/components/ui/sheet/SheetContent.vue'
import SheetDescription from '@/components/ui/sheet/SheetDescription.vue'
import SheetTitle from '@/components/ui/sheet/SheetTitle.vue'
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
  'grid w-full gap-1 rounded-xl px-3 py-2 text-left text-primary-warm-white hover:bg-transparency-white-t8 aria-[current=page]:bg-transparency-white-t8'
</script>

<template>
  <Sheet v-model:open="open">
    <SheetContent
      :close-label="t('cmsAdmin.review.close')"
      class="w-full gap-0 bg-primary-comfy-ink-light sm:max-w-sm"
    >
      <div class="grid gap-1 p-6 pr-20">
        <SheetTitle class="text-xl">
          {{ t('cmsAdmin.preview.changesTitle') }}
        </SheetTitle>
        <SheetDescription>
          {{ t('cmsAdmin.preview.changesNote') }}
        </SheetDescription>
      </div>
      <ul class="grid gap-1 overflow-y-auto px-3 pb-6">
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
              <span class="font-medium">{{ change.title }}</span>
              <span
                class="flex items-center gap-2 text-xs text-primary-comfy-orange"
              >
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
            <span class="font-medium">{{ change.title }}</span>
            <span
              class="flex items-center gap-2 text-xs text-primary-comfy-canvas"
            >
              <ChangeTag :change="change.change" :locale />
              {{ change.detail }}
            </span>
          </a>
        </li>
      </ul>
      <a
        href="/admin/"
        class="mx-6 mt-auto mb-6 rounded-2xl border border-transparency-white-t20 px-4 py-2 text-center text-sm hover:border-primary-comfy-yellow"
      >
        {{ t('cmsAdmin.preview.toAdmin') }}
      </a>
    </SheetContent>
  </Sheet>
</template>
