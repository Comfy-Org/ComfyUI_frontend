<script setup lang="ts">
import { computed } from 'vue'

import DraftGroup from '@/components/cms/DraftGroup.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { QueueItem, SubmissionQueueItem } from '@/lib/cms/queue'
import type { StageEntry, StageStatus } from '@/lib/cms/stage-status'

/** The rows of one review tab: submissions first, then the team's edits. */
const {
  tab,
  inTabCount,
  submissions,
  changes,
  stageOf,
  openId,
  canApply,
  locale = 'en'
} = defineProps<{
  tab: StageStatus
  /** Rows in the tab before the kind filter and search narrow them. */
  inTabCount: number
  submissions: QueueItem[]
  changes: QueueItem[]
  stageOf: (item: QueueItem) => StageEntry
  openId?: string
  canApply: boolean
  locale?: Locale
}>()
const emit = defineEmits<{
  decide: [items: QueueItem[], status: StageStatus]
  reject: [items: SubmissionQueueItem[]]
  open: [id: string]
}>()
const { t } = translationsFor(locale)
const reviewing = computed(() => tab === 'NEW')
const groups = computed(() =>
  [
    { key: 'submissions', items: submissions },
    { key: 'team', items: changes }
  ].filter((group) => group.items.length > 0)
)
</script>

<template>
  <p
    v-if="groups.length === 0"
    class="rounded-lg border border-admin-line px-6 py-10 text-center text-xs text-admin-muted"
  >
    {{
      inTabCount === 0
        ? t(`cmsAdmin.stage.empty.${tab}`)
        : t('cmsAdmin.draft.noMatches')
    }}
  </p>
  <DraftGroup
    v-for="group in groups"
    :key="`${group.key}-${tab}`"
    :title="t(`cmsAdmin.draft.${group.key}.title`)"
    :help="reviewing ? t(`cmsAdmin.draft.${group.key}.help`) : undefined"
    :items="group.items"
    :stage-of="stageOf"
    :open-id="openId"
    :can-apply="canApply"
    :bulk="reviewing"
    :locale
    @decide="(items, status) => emit('decide', items, status)"
    @reject="emit('reject', $event)"
    @open="emit('open', $event)"
  />
</template>
