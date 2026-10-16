<script setup lang="ts">
import { Plus, Trash2 } from '@lucide/vue'

import EditorField from '@/components/cms/editor/EditorField.vue'
import EditorSection from '@/components/cms/editor/EditorSection.vue'
import AdminButton from '@/components/cms/ui/AdminButton.vue'
import { fieldClass } from '@/components/cms/ui/field'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { EditorFaq } from '@/lib/cms/editor'

/** Questions and answers shown at the bottom of the page. */
const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const faq = defineModel<EditorFaq[]>({ required: true })
const { t } = translationsFor(locale)

function add() {
  faq.value = [...faq.value, { question: '', answer: '' }]
}
function remove(index: number) {
  faq.value = faq.value.filter((_, at) => at !== index)
}
</script>

<template>
  <EditorSection
    :title="t('cmsAdmin.editor.faq.title')"
    :description="t('cmsAdmin.editor.faq.help')"
  >
    <template #actions>
      <AdminButton size="sm" :icon="Plus" @click="add">
        {{ t('cmsAdmin.editor.faq.add') }}
      </AdminButton>
    </template>
    <p
      v-if="faq.length === 0"
      class="rounded-lg border border-dashed border-admin-line px-4 py-6 text-center text-xs text-admin-muted"
    >
      {{ t('cmsAdmin.editor.faq.empty') }}
    </p>
    <ol v-else class="grid gap-3">
      <li
        v-for="(entry, index) in faq"
        :key="index"
        class="grid gap-3 rounded-lg border border-admin-line p-4"
      >
        <div class="flex items-start gap-2">
          <EditorField
            :label="t('cmsAdmin.editor.faq.question')"
            class="min-w-0 flex-1"
          >
            <input v-model="entry.question" :class="fieldClass" />
          </EditorField>
          <AdminButton
            variant="dangerGhost"
            size="sm"
            :icon="Trash2"
            :aria-label="t('cmsAdmin.editor.faq.remove')"
            class="mt-5"
            @click="remove(index)"
          />
        </div>
        <EditorField :label="t('cmsAdmin.editor.faq.answer')">
          <textarea v-model="entry.answer" rows="3" :class="fieldClass" />
        </EditorField>
      </li>
    </ol>
  </EditorSection>
</template>
