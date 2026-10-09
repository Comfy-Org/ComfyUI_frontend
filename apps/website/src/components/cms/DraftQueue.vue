<script setup lang="ts">
import { ChevronRight, Eye, Search } from '@lucide/vue'
import { computed, ref } from 'vue'
import { cn } from '@comfyorg/tailwind-utils'

import ChangeTag from '@/components/cms/ChangeTag.vue'
import PublishDialog from '@/components/cms/PublishDialog.vue'
import QueueThumb from '@/components/cms/QueueThumb.vue'
import RejectDialog from '@/components/cms/RejectDialog.vue'
import ReviewSheet from '@/components/cms/ReviewSheet.vue'
import Button from '@/components/ui/button/Button.vue'
import Checkbox from '@/components/ui/checkbox/Checkbox.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import { formatUtc } from '@/lib/cms/format'
import type { QueueItem, SubmissionQueueItem } from '@/lib/cms/queue'

const {
  items,
  csrf,
  canApply,
  draftId,
  generation,
  locale = 'en'
} = defineProps<{
  items: QueueItem[]
  csrf: string
  canApply: boolean
  draftId: number
  generation: number
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const kinds = ['MODEL', 'WORKFLOW', 'APP'] as const
const filter = ref<(typeof kinds)[number] | 'ALL'>('ALL')
const query = ref('')
const excluded = ref(new Set<string>())
const openId = ref<string>()
const publishing = ref(false)
const rejecting = ref<SubmissionQueueItem[]>([])

const isIncluded = (item: QueueItem) => !excluded.value.has(item.id)
const included = computed(() => items.filter(isIncluded))
const held = computed(() =>
  items.filter(
    (item): item is SubmissionQueueItem =>
      item.source === 'submission' && !isIncluded(item)
  )
)
const scheduled = computed(
  () =>
    included.value.filter(
      (item) =>
        item.source === 'catalog' &&
        item.visibleFrom &&
        Date.parse(item.visibleFrom) > Date.now()
    ).length
)
const visible = computed(() => {
  const needle = query.value.trim().toLowerCase()
  return items.filter(
    (item) =>
      (filter.value === 'ALL' || item.kind === filter.value) &&
      (!needle ||
        [
          item.title,
          item.source === 'submission' ? item.author : item.provider,
          item.source === 'submission' ? item.shareId : item.slug
        ]
          .join(' ')
          .toLowerCase()
          .includes(needle))
  )
})
const openIndex = computed(() =>
  visible.value.findIndex((item) => item.id === openId.value)
)
const openItem = computed(() => visible.value[openIndex.value])
const sheetOpen = computed({
  get: () => openItem.value !== undefined,
  set: (value) => {
    if (!value) openId.value = undefined
  }
})
const allSubmissionsIncluded = computed(() => held.value.length === 0)

function setIncluded(item: QueueItem, value: boolean) {
  const next = new Set(excluded.value)
  if (value) next.delete(item.id)
  else next.add(item.id)
  excluded.value = next
}
function setAllIncluded(value: boolean) {
  excluded.value = value
    ? new Set()
    : new Set(
        items.filter((item) => item.source === 'submission').map((i) => i.id)
      )
}
function step(direction: -1 | 1) {
  openId.value = visible.value[openIndex.value + direction]?.id
}
const canToggle = (item: QueueItem) => canApply && item.source === 'submission'

const appears = (item: QueueItem) => {
  if (item.change === 'removed') return t('cmsAdmin.draft.removedOnPublish')
  if (item.source === 'catalog' && item.visibleFrom)
    return formatUtc(item.visibleFrom, locale)
  return t('cmsAdmin.draft.onPublish')
}
const isLater = (item: QueueItem) =>
  item.source === 'catalog' &&
  !!item.visibleFrom &&
  Date.parse(item.visibleFrom) > Date.now()

const stat = 'grid gap-0.5 px-5 py-3'
</script>

<template>
  <div class="grid gap-5">
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div class="max-w-2xl">
        <h1 class="text-3xl font-semibold text-primary-warm-white">
          {{ t('cmsAdmin.draft.title') }}
        </h1>
        <p class="mt-2 text-primary-comfy-canvas">
          {{ t('cmsAdmin.draft.help') }}
        </p>
      </div>
      <div class="flex flex-wrap gap-3">
        <Button
          href="/hub/models/?preview=DRAFT"
          variant="ghost"
          :prepend-icon="Eye"
        >
          {{ t('cmsAdmin.previewDraft') }}
        </Button>
        <Button
          :disabled="!canApply || included.length === 0"
          @click="publishing = true"
        >
          {{
            t(
              'cmsAdmin.draft.publish',
              { count: included.length },
              included.length
            )
          }}
        </Button>
      </div>
    </header>

    <p
      v-if="!canApply"
      class="rounded-2xl border border-transparency-white-t8 px-4 py-3 text-sm text-primary-comfy-canvas"
    >
      {{ t('cmsAdmin.applyOnly') }}
    </p>

    <dl
      class="grid grid-cols-2 divide-transparency-white-t8 overflow-hidden rounded-2xl border border-transparency-white-t8 md:grid-cols-4 md:divide-x"
    >
      <div :class="stat">
        <dt class="text-xs text-primary-comfy-canvas">
          {{ t('cmsAdmin.draft.waiting') }}
        </dt>
        <dd class="text-2xl font-semibold tabular-nums">{{ items.length }}</dd>
      </div>
      <div :class="stat">
        <dt class="text-xs text-primary-comfy-canvas">
          {{ t('cmsAdmin.draft.included') }}
        </dt>
        <dd class="text-2xl font-semibold tabular-nums">
          {{ included.length }}
        </dd>
      </div>
      <div :class="stat">
        <dt class="text-xs text-primary-comfy-canvas">
          {{ t('cmsAdmin.draft.held') }}
        </dt>
        <dd
          :class="
            cn(
              'text-2xl font-semibold tabular-nums',
              held.length && 'text-primary-comfy-orange'
            )
          "
        >
          {{ held.length }}
        </dd>
      </div>
      <div :class="stat">
        <dt class="text-xs text-primary-comfy-canvas">
          {{ t('cmsAdmin.draft.scheduled') }}
        </dt>
        <dd class="text-2xl font-semibold tabular-nums">{{ scheduled }}</dd>
      </div>
    </dl>

    <div
      v-if="held.length"
      class="flex flex-wrap items-center gap-3 rounded-2xl border border-primary-comfy-orange/30 bg-primary-comfy-orange/5 px-4 py-3 text-sm"
    >
      <span class="mr-auto">
        {{
          t('cmsAdmin.draft.heldBar', {
            count: held.length,
            titles: held.map((item) => item.title).join(', ')
          })
        }}
      </span>
      <Button variant="ghost" size="sm" @click="setAllIncluded(true)">
        {{ t('cmsAdmin.draft.includeAgain') }}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        class="text-destructive-light"
        @click="rejecting = held"
      >
        {{
          t('cmsAdmin.draft.rejectHeld', { count: held.length }, held.length)
        }}
      </Button>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <div
        role="group"
        :aria-label="t('cmsAdmin.draft.filterLabel')"
        class="flex flex-wrap gap-2"
      >
        <button
          v-for="kind in ['ALL', ...kinds] as const"
          :key="kind"
          type="button"
          :aria-pressed="filter === kind"
          :class="
            cn(
              'rounded-full border px-3 py-1 text-sm transition-colors',
              filter === kind
                ? 'border-primary-warm-white text-primary-warm-white'
                : 'border-transparency-white-t20 text-primary-comfy-canvas hover:text-primary-warm-white'
            )
          "
          @click="filter = kind"
        >
          {{
            kind === 'ALL'
              ? t('cmsAdmin.draft.all')
              : t(`cmsAdmin.draft.filter.${kind}`)
          }}
          <span class="ml-1 text-xs text-primary-comfy-canvas tabular-nums">{{
            kind === 'ALL'
              ? items.length
              : items.filter((item) => item.kind === kind).length
          }}</span>
        </button>
      </div>
      <label class="relative ml-auto w-full sm:w-72">
        <span class="sr-only">{{ t('cmsAdmin.draft.search') }}</span>
        <Search
          class="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-primary-comfy-canvas"
          aria-hidden="true"
        />
        <input
          v-model="query"
          type="search"
          :placeholder="t('cmsAdmin.draft.search')"
          class="w-full rounded-full border border-transparency-white-t20 bg-site-bg-soft py-2 pr-4 pl-9 text-sm outline-none focus-visible:border-primary-comfy-yellow"
        />
      </label>
    </div>

    <div
      v-if="items.length === 0"
      class="grid justify-items-center gap-2 rounded-2xl border border-transparency-white-t8 px-6 py-16 text-center"
    >
      <p class="text-lg font-semibold">{{ t('cmsAdmin.draft.emptyTitle') }}</p>
      <p class="text-primary-comfy-canvas">
        {{ t('cmsAdmin.draft.emptyBody') }}
      </p>
    </div>

    <div
      v-else
      role="table"
      class="overflow-hidden rounded-2xl border border-transparency-white-t8"
    >
      <div
        role="row"
        class="grid grid-cols-[2.5rem_4rem_minmax(0,1fr)_1.5rem] items-center gap-4 bg-site-bg-soft px-4 py-2 text-xs tracking-widest text-primary-comfy-canvas uppercase md:grid-cols-[2.5rem_4rem_minmax(0,1fr)_11rem_10rem_1.5rem]"
      >
        <span role="columnheader">
          <Checkbox
            :model-value="
              allSubmissionsIncluded
                ? true
                : held.length ===
                    items.filter((i) => i.source === 'submission').length
                  ? false
                  : 'indeterminate'
            "
            :disabled="!canApply"
            :aria-label="t('cmsAdmin.draft.includeAll')"
            @update:model-value="setAllIncluded($event === true)"
          />
        </span>
        <span role="columnheader" />
        <span role="columnheader">{{
          t('cmsAdmin.draft.columns.change')
        }}</span>
        <span role="columnheader" class="hidden md:block">
          {{ t('cmsAdmin.draft.columns.from') }}
        </span>
        <span role="columnheader" class="hidden md:block">
          {{ t('cmsAdmin.draft.columns.appears') }}
        </span>
        <span role="columnheader" />
      </div>
      <p
        v-if="visible.length === 0"
        class="border-t border-transparency-white-t8 px-6 py-10 text-center text-primary-comfy-canvas"
      >
        {{ t('cmsAdmin.draft.noMatches') }}
      </p>
      <div
        v-for="item in visible"
        :key="item.id"
        role="row"
        :class="
          cn(
            'relative grid cursor-pointer grid-cols-[2.5rem_4rem_minmax(0,1fr)_1.5rem] items-center gap-4 border-t border-transparency-white-t8 px-4 py-3 transition-colors hover:bg-transparency-white-t4 md:grid-cols-[2.5rem_4rem_minmax(0,1fr)_11rem_10rem_1.5rem]',
            openId === item.id && 'bg-transparency-white-t4'
          )
        "
        @click="openId = item.id"
      >
        <span role="cell" @click.stop>
          <Checkbox
            :model-value="isIncluded(item)"
            :disabled="!canToggle(item)"
            :title="
              item.source === 'catalog'
                ? t('cmsAdmin.draft.catalogLocked')
                : undefined
            "
            :aria-label="t('cmsAdmin.draft.include', { title: item.title })"
            @update:model-value="setIncluded(item, $event === true)"
          />
        </span>
        <QueueThumb
          role="cell"
          :src="item.thumbnail"
          :class="cn('w-16', !isIncluded(item) && 'opacity-40')"
        />
        <span
          role="cell"
          :class="cn('grid min-w-0 gap-1', !isIncluded(item) && 'opacity-50')"
        >
          <button
            type="button"
            class="truncate text-left font-medium text-primary-warm-white outline-none focus-visible:underline"
            @click.stop="openId = item.id"
          >
            {{ item.title }}
          </button>
          <span
            class="flex flex-wrap items-center gap-2 text-xs text-primary-comfy-canvas"
          >
            <ChangeTag :change="item.change" :locale />
            {{ t(`cmsAdmin.kind.${item.kind}`) }}
            <span v-if="!isIncluded(item)" class="text-primary-comfy-orange">
              · {{ t('cmsAdmin.draft.waits') }}
            </span>
          </span>
        </span>
        <span
          role="cell"
          class="hidden min-w-0 text-sm md:grid"
          :class="!isIncluded(item) && 'opacity-50'"
        >
          <span class="truncate">{{
            item.source === 'submission'
              ? item.author
              : (item.provider ?? t('cmsAdmin.draft.catalogSource'))
          }}</span>
          <span
            v-if="item.source === 'submission'"
            class="text-xs text-primary-comfy-canvas"
            >{{ formatUtc(item.submittedAt, locale) }}</span
          >
        </span>
        <span
          role="cell"
          class="hidden text-sm md:grid"
          :class="!isIncluded(item) && 'opacity-50'"
        >
          <span :class="isLater(item) && 'text-primary-comfy-orange'">{{
            appears(item)
          }}</span>
          <span v-if="isLater(item)" class="text-xs text-primary-comfy-canvas">
            {{ t('cmsAdmin.draft.hiddenUntil') }}
          </span>
        </span>
        <ChevronRight
          role="cell"
          class="size-4 text-primary-comfy-canvas"
          aria-hidden="true"
        />
      </div>
    </div>

    <ReviewSheet
      v-if="openItem"
      v-model:open="sheetOpen"
      :included="isIncluded(openItem)"
      :item="openItem"
      :index="openIndex"
      :total="visible.length"
      :can-apply="canApply"
      :locale
      @update:included="setIncluded(openItem, $event)"
      @step="step"
      @reject="openItem.source === 'submission' && (rejecting = [openItem])"
    />
    <PublishDialog
      v-model:open="publishing"
      :items="included"
      :held-count="held.length"
      :csrf
      :draft-id="draftId"
      :generation
      :locale
    />
    <RejectDialog
      :open="rejecting.length > 0"
      :items="rejecting"
      :csrf
      :locale
      @update:open="!$event && (rejecting = [])"
    />
  </div>
</template>
