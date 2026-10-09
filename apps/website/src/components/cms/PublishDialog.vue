<script setup lang="ts">
import ChangeTag from '@/components/cms/ChangeTag.vue'
import Button from '@/components/ui/button/Button.vue'
import Dialog from '@/components/ui/dialog/Dialog.vue'
import DialogContent from '@/components/ui/dialog/DialogContent.vue'
import DialogDescription from '@/components/ui/dialog/DialogDescription.vue'
import DialogTitle from '@/components/ui/dialog/DialogTitle.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { QueueItem } from '@/lib/cms/queue'

const {
  items,
  heldCount,
  csrf,
  draftId,
  generation,
  locale = 'en'
} = defineProps<{
  items: QueueItem[]
  heldCount: number
  csrf: string
  draftId: number
  generation: number
  locale?: Locale
}>()
const open = defineModel<boolean>('open', { required: true })
const { t } = translationsFor(locale)
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent :close-label="t('cmsAdmin.review.close')" class="grid gap-5">
      <DialogTitle class="pr-14 text-2xl">
        {{ t('cmsAdmin.publish.title', { count: items.length }, items.length) }}
      </DialogTitle>
      <ul
        class="grid max-h-64 gap-1 overflow-y-auto rounded-2xl border border-transparency-white-t8 p-2"
      >
        <li
          v-for="item in items"
          :key="item.id"
          class="flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm"
        >
          <ChangeTag :change="item.change" :locale />
          <span class="truncate">{{ item.title }}</span>
        </li>
      </ul>
      <DialogDescription class="grid gap-2 text-sm text-primary-comfy-canvas">
        <span>{{ t('cmsAdmin.publish.body') }}</span>
        <span v-if="heldCount" class="text-primary-comfy-orange">
          {{ t('cmsAdmin.publish.held', { count: heldCount }, heldCount) }}
        </span>
      </DialogDescription>
      <form
        data-astro-reload
        method="post"
        action="/admin/actions"
        class="flex flex-wrap justify-end gap-3"
      >
        <input type="hidden" name="csrf" :value="csrf" />
        <input type="hidden" name="action" value="publish" />
        <input type="hidden" name="confirm" value="yes" />
        <input type="hidden" name="draft_id" :value="draftId" />
        <input type="hidden" name="generation" :value="generation" />
        <template v-for="item in items" :key="item.id">
          <input
            v-if="item.source === 'submission'"
            type="hidden"
            name="approve"
            :value="`${item.shareId}:${item.versionId}`"
          />
        </template>
        <Button type="button" variant="ghost" @click="open = false">
          {{ t('cmsAdmin.publish.cancel') }}
        </Button>
        <Button type="submit">{{ t('cmsAdmin.publish.confirm') }}</Button>
      </form>
    </DialogContent>
  </Dialog>
</template>
