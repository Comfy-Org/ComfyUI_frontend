<script setup lang="ts">
import { computed } from 'vue'

import DraftGroup from '@/components/cms/DraftGroup.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { QueueItem } from '@/lib/cms/queue'

/** The draft's rows: brand-new content first, then edits to what's live. */
const {
  fresh,
  updates,
  openId,
  selectable = false,
  selected = [],
  locale = 'en'
} = defineProps<{
  fresh: QueueItem[]
  updates: QueueItem[]
  openId?: string
  selectable?: boolean
  selected?: string[]
  locale?: Locale
}>()
const emit = defineEmits<{ open: [id: string]; select: [id: string] }>()
const { t } = translationsFor(locale)
const groups = computed(() =>
  [
    { key: 'fresh', items: fresh },
    { key: 'updates', items: updates }
  ].filter((group) => group.items.length > 0)
)
</script>

<template>
  <p
    v-if="groups.length === 0"
    class="rounded-lg border border-admin-line px-6 py-10 text-center text-xs text-admin-muted"
  >
    {{ t('cmsAdmin.draft.noMatches') }}
  </p>
  <DraftGroup
    v-for="group in groups"
    :key="group.key"
    :title="t(`cmsAdmin.draft.${group.key}.title`)"
    :help="t(`cmsAdmin.draft.${group.key}.help`)"
    :items="group.items"
    :open-id="openId"
    :selectable
    :selected
    :locale
    @open="emit('open', $event)"
    @select="emit('select', $event)"
  />
</template>
