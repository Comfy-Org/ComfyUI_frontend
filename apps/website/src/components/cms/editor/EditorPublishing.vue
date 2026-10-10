<script setup lang="ts">
import { Archive, RotateCcw } from '@lucide/vue'

import EditorField from '@/components/cms/editor/EditorField.vue'
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
  locale = 'en'
} = defineProps<{
  isNew: boolean
  /** Whether the saved item is archived, not the unsaved form. */
  archived: boolean
  busy: boolean
  locale?: Locale
}>()
const state = defineModel<EditorState>({ required: true })
const emit = defineEmits<{ archive: [deleted: boolean] }>()
const { t } = translationsFor(locale)
</script>

<template>
  <aside class="grid gap-5 lg:sticky lg:top-6">
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
