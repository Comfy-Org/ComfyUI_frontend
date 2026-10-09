<script setup lang="ts">
import { ChevronDown, ChevronUp, Eye, Play } from '@lucide/vue'
import { cn } from '@comfyorg/tailwind-utils'

import ChangeTag from '@/components/cms/ChangeTag.vue'
import QueueThumb from '@/components/cms/QueueThumb.vue'
import Button from '@/components/ui/button/Button.vue'
import CopyTextButton from '@/components/ui/copy-text-button/CopyTextButton.vue'
import IconButton from '@/components/ui/icon-button/IconButton.vue'
import Sheet from '@/components/ui/sheet/Sheet.vue'
import SheetContent from '@/components/ui/sheet/SheetContent.vue'
import SheetDescription from '@/components/ui/sheet/SheetDescription.vue'
import SheetTitle from '@/components/ui/sheet/SheetTitle.vue'
import Switch from '@/components/ui/switch/Switch.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import { formatUtc, formatValue, humanizeField } from '@/lib/cms/format'
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

const cloudRun = (shareId: string) =>
  `https://cloud.comfy.org/?share=${encodeURIComponent(shareId)}`
const pagePreview = (slug: string) =>
  `${slug.replace(/\/?$/, '/')}?preview=DRAFT`
const sectionTitle =
  'mb-3 text-xs font-medium tracking-widest text-primary-comfy-canvas uppercase'
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
            <template v-if="item.source === 'submission'">
              {{ item.author }} ·
              {{
                t('cmsAdmin.review.submitted', {
                  date: formatUtc(item.submittedAt, locale)
                })
              }}
            </template>
            <template v-else>
              {{ item.provider ?? t('cmsAdmin.draft.catalogSource') }} ·
              {{ item.slug }}
            </template>
          </SheetDescription>
        </div>

        <template v-if="item.source === 'submission'">
          <div
            class="flex flex-wrap items-center gap-4 rounded-2xl border border-transparency-white-t8 bg-site-bg-soft p-4"
          >
            <div class="min-w-0 flex-1">
              <p class="font-semibold text-primary-warm-white">
                {{ t('cmsAdmin.review.runTitle') }}
              </p>
              <p
                class="mt-1 flex items-center gap-2 text-sm text-primary-comfy-canvas"
              >
                {{ t('cmsAdmin.review.shareId') }}
                <code class="font-mono text-xs">{{ item.shareId }}</code>
                <CopyTextButton
                  :value="item.shareId"
                  :label="t('cmsAdmin.review.copy')"
                  :copied-label="t('cmsAdmin.review.copied')"
                />
              </p>
            </div>
            <Button
              :href="cloudRun(item.shareId)"
              target="_blank"
              rel="noopener"
              size="sm"
              :prepend-icon="Play"
            >
              {{ t('cmsAdmin.review.runAction') }}
            </Button>
          </div>
          <section>
            <h3 :class="sectionTitle">
              {{ t('cmsAdmin.review.description') }}
            </h3>
            <p class="text-primary-warm-white">{{ item.description }}</p>
            <p class="mt-2 text-sm text-primary-comfy-canvas">
              {{
                t(
                  item.listed
                    ? 'cmsAdmin.review.listed'
                    : 'cmsAdmin.review.unlisted'
                )
              }}
            </p>
          </section>
        </template>

        <template v-else>
          <div v-if="item.thumbnail" class="grid gap-3">
            <QueueThumb :src="item.thumbnail" class="w-full rounded-2xl" />
          </div>
          <Button
            v-if="item.change !== 'removed'"
            :href="pagePreview(item.slug)"
            variant="ghost"
            size="sm"
            class="w-fit"
            :prepend-icon="Eye"
          >
            {{ t('cmsAdmin.review.seeOnPage') }}
          </Button>
          <section>
            <h3 :class="sectionTitle">
              {{ t('cmsAdmin.review.changesTitle') }}
            </h3>
            <ul class="grid gap-3">
              <li
                v-for="group in item.fields"
                :key="group.field"
                class="overflow-hidden rounded-xl border border-transparency-white-t8"
              >
                <p
                  class="border-b border-transparency-white-t8 bg-site-bg-soft px-4 py-2 text-xs text-primary-comfy-canvas"
                >
                  {{ humanizeField(group.field) }}
                </p>
                <dl class="grid text-sm">
                  <div
                    v-if="item.change !== 'new'"
                    class="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-2 px-4 py-2 text-primary-comfy-canvas"
                  >
                    <dt>{{ t('cmsAdmin.review.before') }}</dt>
                    <dd
                      class="wrap-break-word line-through decoration-destructive-light/60"
                    >
                      {{
                        formatValue(group.before) || t('cmsAdmin.review.empty')
                      }}
                    </dd>
                  </div>
                  <div
                    v-if="item.change !== 'removed'"
                    :class="
                      cn(
                        'grid grid-cols-[4.5rem_minmax(0,1fr)] gap-2 px-4 py-2 text-primary-warm-white',
                        item.change !== 'new' &&
                          'border-t border-dashed border-transparency-white-t8'
                      )
                    "
                  >
                    <dt class="text-primary-comfy-canvas">
                      {{ t('cmsAdmin.review.after') }}
                    </dt>
                    <dd class="wrap-break-word">
                      <template
                        v-if="Array.isArray(group.after) && group.added.length"
                      >
                        <span
                          v-for="(value, i) in group.after"
                          :key="i"
                          :class="
                            cn(
                              'mr-1 inline-block',
                              group.added.includes(value) &&
                                'rounded-sm bg-primary-comfy-yellow/15 px-1 text-primary-comfy-yellow'
                            )
                          "
                          >{{ formatValue(value)
                          }}{{ i < group.after.length - 1 ? ',' : '' }}</span
                        >
                      </template>
                      <template v-else>
                        {{
                          formatValue(group.after) || t('cmsAdmin.review.empty')
                        }}
                      </template>
                    </dd>
                  </div>
                </dl>
              </li>
            </ul>
          </section>
        </template>
      </div>

      <footer
        class="flex flex-wrap items-center gap-3 border-t border-transparency-white-t8 px-6 py-4"
      >
        <label
          v-if="item.source === 'submission'"
          class="flex cursor-pointer items-center gap-3 text-sm"
        >
          <Switch v-model="included" :disabled="!canApply" />
          {{ t('cmsAdmin.review.include') }}
        </label>
        <p v-else class="text-xs text-primary-comfy-canvas">
          {{ t('cmsAdmin.draft.catalogLocked') }}
        </p>
        <Button
          v-if="item.source === 'submission' && canApply"
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
