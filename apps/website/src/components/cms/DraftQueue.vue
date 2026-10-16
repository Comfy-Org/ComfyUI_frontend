<script setup lang="ts">
import { Eye, Upload } from '@lucide/vue'
import { computed, ref } from 'vue'

import DraftTable from '@/components/cms/DraftTable.vue'
import FinalReviewDialog from '@/components/cms/FinalReviewDialog.vue'
import ListingFilters from '@/components/cms/ListingFilters.vue'
import ReviewSheet from '@/components/cms/ReviewSheet.vue'
import AdminButton from '@/components/cms/ui/AdminButton.vue'
import AdminTabs from '@/components/cms/ui/AdminTabs.vue'
import PageHeader from '@/components/cms/ui/PageHeader.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { ListingFilter } from '@/lib/cms/format'
import { kindCounts, matchesListing } from '@/lib/cms/format'
import type { QueueItem } from '@/lib/cms/queue'
import type { Staging } from '@/lib/cms/stage-status'
import { stageOf } from '@/lib/cms/stage-status'

const {
  items,
  staging = {},
  stagingSaved = false,
  csrf,
  canApply,
  canEdit = false,
  draftId,
  generation,
  locale = 'en'
} = defineProps<{
  items: QueueItem[]
  staging?: Staging
  /** Whether the API keeps review state; unpicked changes are left for later there before a publish. */
  stagingSaved?: boolean
  csrf: string
  canApply: boolean
  canEdit?: boolean
  draftId: number
  generation: number
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const filter = ref<ListingFilter>('ALL')
const query = ref('')
const openId = ref<string>()
const publishing = ref(false)

type DraftTab = 'ALL' | 'NEW' | 'UPDATES'
const tab = ref<DraftTab>('ALL')
const inTab = (value: DraftTab) =>
  items.filter(
    (item) => value === 'ALL' || (value === 'NEW') === (item.change === 'new')
  )
const tabs = computed(() =>
  (['ALL', 'NEW', 'UPDATES'] as const).map((value) => ({
    value,
    label: t(`cmsAdmin.draft.tab.${value}`, { count: inTab(value).length })
  }))
)
const kinds = computed(() =>
  kindCounts(inTab(tab.value).map((item) => item.kind))
)
// New content first, so a brand-new page is never buried under edits.
const visible = computed(() =>
  inTab(tab.value)
    .filter((item) =>
      matchesListing(filter.value, query.value, item.kind, [
        item.title,
        item.source === 'submission' ? item.author : item.provider,
        item.source === 'submission' ? item.shareId : item.slug
      ])
    )
    .toSorted((a, b) => Number(b.change === 'new') - Number(a.change === 'new'))
)
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
function step(direction: -1 | 1) {
  openId.value = visible.value[openIndex.value + direction]?.id
}

// Ticked rows go live together; everything else stays in the draft.
const selected = ref<string[]>([])
const picked = computed(() =>
  items.filter((item) => selected.value.includes(item.id))
)
const leftOver = computed(() =>
  items.filter(
    (item) =>
      !selected.value.includes(item.id) &&
      stageOf(staging, item.id).status === 'NEW'
  )
)
function toggle(id: string) {
  selected.value = selected.value.includes(id)
    ? selected.value.filter((chosen) => chosen !== id)
    : [...selected.value, id]
}
function selectShown(checked: boolean) {
  const ids = visible.value.map((item) => item.id)
  selected.value = checked
    ? [...new Set([...selected.value, ...ids])]
    : selected.value.filter((id) => !ids.includes(id))
}
</script>

<template>
  <div class="grid gap-5">
    <PageHeader
      :title="t('cmsAdmin.draft.title')"
      :description="t('cmsAdmin.draft.help')"
    >
      <template #actions>
        <AdminButton
          v-if="items.length > 0"
          href="/hub/models/?preview=DRAFT&changes=open"
          target="_blank"
          rel="noopener"
          :icon="Eye"
        >
          {{ t('cmsAdmin.previewDraft') }}
        </AdminButton>
        <AdminButton
          v-if="canApply && items.length > 0"
          variant="primary"
          :icon="Upload"
          :disabled="picked.length === 0"
          @click="publishing = true"
        >
          {{
            t('cmsAdmin.bulk.publish', { count: picked.length }, picked.length)
          }}
        </AdminButton>
      </template>
    </PageHeader>

    <p
      v-if="!canApply"
      class="rounded-lg border border-admin-info/25 bg-admin-info/10 px-3 py-2 text-xs text-admin-fg"
    >
      {{ t('cmsAdmin.applyOnly') }}
    </p>

    <div
      v-if="items.length === 0"
      class="grid justify-items-center gap-1 rounded-lg border border-dashed border-admin-line px-6 py-14 text-center"
    >
      <p class="text-sm font-medium">{{ t('cmsAdmin.draft.emptyTitle') }}</p>
      <p class="text-xs text-admin-muted">
        {{ t('cmsAdmin.draft.emptyBody') }}
      </p>
    </div>

    <template v-else>
      <ListingFilters
        v-model:filter="filter"
        v-model:query="query"
        :counts="kinds"
        :search-label="t('cmsAdmin.draft.search')"
        :locale
      >
        <AdminTabs
          v-model="tab"
          :options="tabs"
          :label="t('cmsAdmin.draft.tabLabel')"
        />
      </ListingFilters>
      <DraftTable
        :items="visible"
        :open-id="openId"
        :selectable="canApply"
        :selected
        :locale
        @select="toggle"
        @all="selectShown"
        @open="openId = $event"
      />
    </template>

    <ReviewSheet
      v-if="openItem"
      v-model:open="sheetOpen"
      :item="openItem"
      :index="openIndex"
      :total="visible.length"
      :can-apply="canApply"
      :can-edit="canEdit"
      :selected="selected.includes(openItem.id)"
      :csrf
      :locale
      @select="toggle(openItem.id)"
      @step="step"
    />
    <FinalReviewDialog
      v-model:open="publishing"
      :items="picked"
      :later-count="items.length - picked.length"
      :not-reviewed="leftOver.map((item) => item.id)"
      :staging-saved="stagingSaved"
      :csrf
      :draft-id="draftId"
      :generation
      :locale
    />
  </div>
</template>
