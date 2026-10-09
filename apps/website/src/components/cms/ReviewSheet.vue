<script setup lang="ts">
import { ChevronDown, ChevronUp } from '@lucide/vue'
import { computed } from 'vue'

import CatalogReview from '@/components/cms/CatalogReview.vue'
import ChangeTag from '@/components/cms/ChangeTag.vue'
import SubmissionReview from '@/components/cms/SubmissionReview.vue'
import Button from '@/components/ui/button/Button.vue'
import IconButton from '@/components/ui/icon-button/IconButton.vue'
import Sheet from '@/components/ui/sheet/Sheet.vue'
import SheetContent from '@/components/ui/sheet/SheetContent.vue'
import SheetDescription from '@/components/ui/sheet/SheetDescription.vue'
import SheetTitle from '@/components/ui/sheet/SheetTitle.vue'
import Switch from '@/components/ui/switch/Switch.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import { formatUtc } from '@/lib/cms/format'
import type { QueueItem } from '@/lib/cms/queue'

const {
  item,
  index,
  total,
  canApply,
  locale = 'en'
} = defineProps<{
  item: QueueItem
  index: number
  total: number
  canApply: boolean
  locale?: Locale
}>()
const open = defineModel<boolean>('open', { required: true })
const included = defineModel<boolean>('included', { required: true })
const emit = defineEmits<{ step: [direction: -1 | 1]; reject: [] }>()
const { t } = translationsFor(locale)

const subtitle = computed(() =>
  item.source === 'submission'
    ? `${item.author} · ${t('cmsAdmin.review.submitted', {
        date: formatUtc(item.submittedAt, locale)
      })}`
    : `${item.provider ?? t('cmsAdmin.draft.catalogSource')} · ${item.slug}`
)
const isSubmission = computed(() => item.source === 'submission')
</script>

<template>
  <Sheet v-model:open="open">
    <SheetContent
      :close-label="t('cmsAdmin.review.close')"
      class="w-full gap-0 border-l border-transparency-white-t8 bg-primary-comfy-ink-light sm:max-w-xl"
    >
      <header
        class="flex items-center gap-1 border-b border-transparency-white-t8 py-4 pr-20 pl-6"
      >
        <span class="mr-auto text-xs text-primary-comfy-canvas tabular-nums">
          {{ t('cmsAdmin.review.position', { index: index + 1, total }) }}
        </span>
        <IconButton
          size="sm"
          :disabled="index === 0"
          :aria-label="t('cmsAdmin.review.previous')"
          @click="emit('step', -1)"
        >
          <ChevronUp class="size-4" />
        </IconButton>
        <IconButton
          size="sm"
          :disabled="index === total - 1"
          :aria-label="t('cmsAdmin.review.next')"
          @click="emit('step', 1)"
        >
          <ChevronDown class="size-4" />
        </IconButton>
      </header>

      <div class="flex min-h-0 flex-1 flex-col gap-7 overflow-y-auto p-6">
        <div class="grid gap-2">
          <div class="flex flex-wrap items-center gap-2 text-xs">
            <ChangeTag :change="item.change" :locale />
            <span class="text-primary-comfy-canvas">
              {{ t(`cmsAdmin.kind.${item.kind}`) }}
            </span>
          </div>
          <SheetTitle class="text-2xl text-balance">
            {{ item.title }}
          </SheetTitle>
          <SheetDescription class="text-sm text-primary-comfy-canvas">
            {{ subtitle }}
          </SheetDescription>
        </div>

        <SubmissionReview
          v-if="item.source === 'submission'"
          :key="item.id"
          :item
          :locale
        />
        <CatalogReview v-else :key="item.id" :item :locale />
      </div>

      <footer
        class="flex flex-wrap items-center gap-3 border-t border-transparency-white-t8 px-6 py-4"
      >
        <label
          v-if="isSubmission"
          class="flex cursor-pointer items-center gap-3 text-sm"
        >
          <Switch v-model="included" :disabled="!canApply" />
          {{ t('cmsAdmin.review.include') }}
        </label>
        <p v-else class="text-xs text-primary-comfy-canvas">
          {{ t('cmsAdmin.draft.catalogLocked') }}
        </p>
        <Button
          v-if="isSubmission && canApply"
          variant="ghost"
          size="sm"
          class="ml-auto text-destructive-light"
          @click="emit('reject')"
        >
          {{ t('cmsAdmin.review.reject') }}
        </Button>
      </footer>
    </SheetContent>
  </Sheet>
</template>
