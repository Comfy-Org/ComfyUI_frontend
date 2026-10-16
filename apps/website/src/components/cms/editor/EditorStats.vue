<script setup lang="ts">
import EditorSection from '@/components/cms/editor/EditorSection.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { EditorState } from '@/lib/cms/editor'
import { compactCount } from '@/lib/cms/stats'

/** Usage numbers from analytics, shown for context; nobody edits them here. */
const { state, locale = 'en' } = defineProps<{
  state: EditorState
  locale?: Locale
}>()
const { stats } = state
// A new page has no usage yet, and apps aren't counted.
const shown = !state.isNew && state.kind !== 'APP'
const { t } = translationsFor(locale)
const cells = (['popularity', 'runs', 'downloads'] as const).map((key) => ({
  key,
  value: stats[key] === undefined ? '—' : compactCount(stats[key], locale)
}))
</script>

<template>
  <EditorSection
    v-if="shown"
    :title="t('cmsAdmin.stats.title')"
    :description="t('cmsAdmin.stats.help')"
  >
    <dl class="grid grid-cols-3 gap-2">
      <div
        v-for="cell in cells"
        :key="cell.key"
        class="grid gap-0.5 rounded-lg border border-admin-line px-3 py-2"
      >
        <dt class="text-xs text-admin-muted">
          {{ t(`cmsAdmin.stats.${cell.key}`) }}
        </dt>
        <dd class="text-base font-medium tabular-nums">{{ cell.value }}</dd>
      </div>
    </dl>
  </EditorSection>
</template>
