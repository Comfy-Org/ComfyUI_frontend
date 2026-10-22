<script setup lang="ts">
import { computed, useId } from 'vue'
import { z } from 'astro/zod'
import { contentTypes } from '@/lib/cms/editor-document'
import EditorTags from './EditorTags.vue'
import EditorUseCases from './EditorUseCases.vue'
import AuthorPicker from './AuthorPicker.vue'
import EditorKindFields from './EditorKindFields.vue'
import {
  editorInputClass as inputClass,
  useEditorFields
} from '@/lib/cms/editor-fields'
import type { ContentType, Document } from '@/lib/cms/editor-document'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

const { locale, existing, schemaVersion, disabled, validChangeID } =
  defineProps<{
    locale: Locale
    existing: boolean
    schemaVersion?: number
    disabled: boolean
    validChangeID: boolean
  }>()
const document = defineModel<Document>({ required: true })
const kind = defineModel<ContentType>('kind', { required: true })
const emit = defineEmits<{ edited: [] }>()
const t = translationsFor(locale).t
const changeIDHelp = useId()
const { value, patch } = useEditorFields(document, () => emit('edited'))
const tags = computed(() => {
  const parsed = z.array(z.string()).safeParse(document.value.tags)
  return parsed.success ? parsed.data : []
})
const useCases = computed(() => {
  const parsed = z.array(z.string()).safeParse(document.value.use_cases)
  return parsed.success ? parsed.data : []
})

const fields = ['title', 'slug', 'description', 'long_description'] as const
function fieldMaxLength(field: string) {
  if (field === 'title') return schemaVersion === 1 ? 300 : 80
  if (field === 'description') return schemaVersion === 1 ? 20000 : 160
  return 200
}
</script>
<template>
  <section
    class="grid gap-5 rounded-xl border border-admin-line bg-admin-card p-5"
  >
    <div class="grid content-start gap-4">
      <h2 class="text-lg font-medium">
        {{ t('cmsEditor.pageContent') }}
      </h2>
      <label class="grid gap-1 text-sm text-admin-muted"
        >{{ t('cmsEditor.type')
        }}<select v-model="kind" :disabled="existing" :class="inputClass">
          <option v-for="item in contentTypes" :key="item" :value="item">
            {{ item }}
          </option>
        </select></label
      >
      <label
        v-for="field in fields"
        :key="field"
        class="grid gap-1 text-sm text-admin-muted"
        >{{
          field === 'long_description'
            ? t('cccMetadata.longDescription')
            : t(`cmsEditor.${field}`)
        }}<textarea
          v-if="field === 'long_description'"
          :value="value(field)"
          rows="12"
          maxlength="20000"
          :class="inputClass"
          @input="patch(field, $event)" /><input
          v-else
          :value="value(field)"
          :required="field === 'title' || field === 'slug'"
          :maxlength="fieldMaxLength(field)"
          :pattern="field === 'slug' ? '[a-z0-9]+(-[a-z0-9]+)*' : undefined"
          :class="inputClass"
          @input="patch(field, $event)"
      /></label>
      <div class="grid gap-1">
        <label class="grid gap-1 text-sm text-admin-muted">
          {{ t('cccEditorBatch.label') }}
          <input
            :value="value('change_id')"
            :class="inputClass"
            maxlength="128"
            :aria-invalid="!validChangeID"
            :aria-describedby="changeIDHelp"
            @input="patch('change_id', $event)"
          />
        </label>
        <p :id="changeIDHelp" class="text-xs text-admin-muted">
          {{ t('cccEditorBatch.help') }}
        </p>
        <p
          v-if="!validChangeID"
          role="alert"
          class="text-xs text-admin-danger-text"
        >
          {{ t('cccEditorBatch.invalid') }}
        </p>
      </div>
      <AuthorPicker
        :model-value="value('author_uid')"
        :locale
        :disabled="disabled"
        @update:model-value="document = { ...document, author_uid: $event }"
      />
      <label class="grid gap-1 text-sm text-admin-muted">
        {{ t('cccMetadata.documentation') }}
        <input
          :value="value('documentation_url')"
          :class="inputClass"
          maxlength="2000"
          @input="patch('documentation_url', $event)"
        />
      </label>
      <p class="text-xs text-admin-muted">
        {{ t('cccMetadata.ownerFixed') }}
      </p>
      <EditorKindFields
        v-model="document"
        :kind
        :locale
        @edited="emit('edited')"
      />
      <div class="grid gap-1 text-sm text-admin-muted">
        <span>{{ t('cmsEditor.tags') }}</span>
        <EditorTags
          :model-value="tags"
          :label="t('cmsEditor.tags')"
          :locale
          :disabled="disabled"
          @update:model-value="document = { ...document, tags: $event }"
        />
      </div>
      <EditorUseCases
        :model-value="useCases"
        :locale
        :disabled="disabled"
        @update:model-value="document = { ...document, use_cases: $event }"
      />
    </div>
  </section>
</template>
