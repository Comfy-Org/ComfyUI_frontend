<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'
import Dialog from '@/components/ui/dialog/Dialog.vue'
import DialogContent from '@/components/ui/dialog/DialogContent.vue'
import DialogDescription from '@/components/ui/dialog/DialogDescription.vue'
import DialogTitle from '@/components/ui/dialog/DialogTitle.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { SubmissionQueueItem } from '@/lib/cms/queue'

const {
  items,
  csrf,
  locale = 'en'
} = defineProps<{
  items: SubmissionQueueItem[]
  csrf: string
  locale?: Locale
}>()
const open = defineModel<boolean>('open', { required: true })
const { t } = translationsFor(locale)
const reasons = ['broken', 'description', 'outputs', 'duplicate', 'other']
const field =
  'w-full rounded-xl border border-transparency-white-t20 bg-site-bg-soft px-3 py-2 text-sm text-primary-warm-white outline-none focus-visible:border-primary-comfy-yellow'
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent :close-label="t('cmsAdmin.review.close')">
      <form
        data-astro-reload
        method="post"
        action="/admin/actions"
        class="grid gap-5"
      >
        <DialogTitle class="pr-14 text-2xl text-balance">
          {{
            items.length === 1
              ? t('cmsAdmin.reject.title', { title: items[0].title })
              : t('cmsAdmin.reject.titleMany', { count: items.length })
          }}
        </DialogTitle>
        <DialogDescription class="text-sm text-primary-comfy-canvas">
          {{ t('cmsAdmin.reject.body') }}
        </DialogDescription>
        <input type="hidden" name="csrf" :value="csrf" />
        <input type="hidden" name="action" value="reject" />
        <input type="hidden" name="confirm" value="yes" />
        <input
          v-for="item in items"
          :key="item.id"
          type="hidden"
          name="submission"
          :value="`${item.shareId}:${item.versionId}`"
        />
        <label class="grid gap-2 text-sm text-primary-comfy-canvas">
          {{ t('cmsAdmin.reject.reason') }}
          <select name="reason" :class="field">
            <option v-for="reason in reasons" :key="reason" :value="reason">
              {{ t(`cmsAdmin.reject.reasons.${reason}`) }}
            </option>
          </select>
        </label>
        <label class="grid gap-2 text-sm text-primary-comfy-canvas">
          {{ t('cmsAdmin.reject.note') }}
          <textarea
            name="note"
            rows="3"
            :placeholder="t('cmsAdmin.reject.notePlaceholder')"
            :class="field"
          />
          <span class="text-xs">{{ t('cmsAdmin.reject.noteApi') }}</span>
        </label>
        <div class="flex flex-wrap justify-end gap-3">
          <Button type="button" variant="ghost" @click="open = false">
            {{ t('cmsAdmin.publish.cancel') }}
          </Button>
          <Button
            type="submit"
            class="bg-destructive-light text-primary-comfy-ink hover:bg-destructive-light/90"
          >
            {{ t('cmsAdmin.reject.confirm') }}
          </Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>
</template>
