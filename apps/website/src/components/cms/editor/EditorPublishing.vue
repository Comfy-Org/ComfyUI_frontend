<script setup lang="ts">
import { Archive, RotateCcw } from '@lucide/vue'

import { computed } from 'vue'

import EditorField from '@/components/cms/editor/EditorField.vue'
import HubCardPreview from '@/components/cms/HubCardPreview.vue'
import UndoChangeButton from '@/components/cms/UndoChangeButton.vue'
import EditorSection from '@/components/cms/editor/EditorSection.vue'
import AdminButton from '@/components/cms/ui/AdminButton.vue'
import { fieldClass } from '@/components/cms/ui/field'
import Switch from '@/components/ui/switch/Switch.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { EditorState } from '@/lib/cms/editor'

const {
  isNew,
  archived,
  busy,
  undo,
  locale = 'en'
} = defineProps<{
  isNew: boolean
  /** Whether the saved item is archived, not the unsaved form. */
  archived: boolean
  busy: boolean
  /** Set when the draft holds saved changes that can be undone. */
  undo?: { csrf: string; uid: string; title: string; published: boolean }
  locale?: Locale
}>()
const state = defineModel<EditorState>({ required: true })
const emit = defineEmits<{ archive: [deleted: boolean] }>()
const { t } = translationsFor(locale)
const cardBadge = computed(() => {
  if (!state.value.enabled)
    return { label: t('cmsAdmin.content.hidden'), tone: 'muted' as const }
  if (state.value.visibility === 'STAFF')
    return { label: t('cmsAdmin.editor.staff'), tone: 'muted' as const }
  if (state.value.visibleFrom)
    return {
      label: t('cmsAdmin.preview.card.scheduled'),
      tone: 'warning' as const
    }
  return undefined
})
</script>

<template>
  <aside class="grid gap-5">
    <EditorSection
      :title="t('cmsAdmin.editor.card.title')"
      :description="t('cmsAdmin.editor.card.help')"
    >
      <HubCardPreview
        :kind="state.kind"
        :title="state.name || t('cmsAdmin.editor.card.untitled')"
        :description="state.summary"
        :byline="state.credit"
        :media="state.cover.url ? state.cover : undefined"
        :badge="cardBadge"
        :empty-label="t('cmsAdmin.editor.card.noCover')"
      />
    </EditorSection>
    <EditorSection :title="t('cmsAdmin.editor.visibility')">
      <label class="flex items-center justify-between gap-3 text-sm">
        {{ t('cmsAdmin.editor.shown') }}
        <Switch v-model="state.enabled" />
      </label>
      <EditorField :label="t('cmsAdmin.editor.audience')">
        <select v-model="state.visibility" :class="fieldClass">
          <option value="PUBLIC">{{ t('cmsAdmin.editor.everyone') }}</option>
          <option value="STAFF">{{ t('cmsAdmin.editor.staff') }}</option>
        </select>
      </EditorField>
      <EditorField
        :label="t('cmsAdmin.editor.appearsFrom')"
        :hint="t('cmsAdmin.editor.appearsHelp')"
      >
        <input
          v-model="state.visibleFrom"
          type="datetime-local"
          :class="fieldClass"
        />
      </EditorField>
    </EditorSection>

    <EditorSection
      v-if="undo"
      :title="t('cmsAdmin.undo.sectionTitle')"
      :description="t('cmsAdmin.undo.sectionHelp')"
    >
      <div class="justify-self-start">
        <UndoChangeButton
          v-bind="undo"
          :destination="
            undo.published
              ? `/admin/edit/${undo.uid}?notice=undone`
              : '/admin/content/'
          "
          :locale
        />
      </div>
    </EditorSection>

    <EditorSection
      v-if="!isNew"
      :title="t('cmsAdmin.editor.archiveTitle')"
      :description="
        archived
          ? t('cmsAdmin.editor.restoreHelp')
          : t('cmsAdmin.editor.archiveHelp')
      "
    >
      <AdminButton
        :variant="archived ? 'secondary' : 'dangerGhost'"
        :icon="archived ? RotateCcw : Archive"
        :disabled="busy"
        class="justify-self-start"
        @click="emit('archive', !archived)"
      >
        {{
          archived ? t('cmsAdmin.editor.restore') : t('cmsAdmin.editor.archive')
        }}
      </AdminButton>
    </EditorSection>
  </aside>
</template>
