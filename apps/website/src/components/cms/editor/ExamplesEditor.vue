<script setup lang="ts">
import { computed, ref } from 'vue'
import { Plus, Trash2 } from '@lucide/vue'
import AdminButton from '@/components/cms/ui/AdminButton.vue'
import JsonField from './JsonField.vue'
import MediaUpload from './MediaUpload.vue'
import type { Document } from '@/lib/cms/editor-document'
import { arrayObjects, objectValue } from '@/lib/cms/editor-document'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
const document = defineModel<Document>({ required: true })
const {
  entityUID,
  draft,
  csrf,
  locale = 'en'
} = defineProps<{
  entityUID?: string
  draft: number
  csrf: string
  locale?: Locale
}>()
const emit = defineEmits<{
  validity: [key: string, valid: boolean]
  busy: [busy: boolean]
}>()
const t = translationsFor(locale).t
const examples = computed(() => arrayObjects(document.value.examples))
// UI-only keys keep invalid buffers attached to their row when another row is
// removed. They are never written into authored examples or used as media IDs.
const rowKeys = ref(examples.value.map(() => crypto.randomUUID()))
function rowKey(index: number) {
  return rowKeys.value[index] ?? `loaded:${index}`
}
function update(index: number, patch: Document) {
  document.value = {
    ...document.value,
    examples: examples.value.map((item, i) =>
      i === index ? { ...item, ...patch } : item
    )
  }
}
function patchText(index: number, key: string, event: Event) {
  if (
    !(
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement
    )
  )
    return
  update(index, { [key]: event.target.value })
}
function media(index: number, reference: Document | undefined) {
  const next = { ...examples.value[index] }
  if (reference) next.media = reference
  else delete next.media
  document.value = {
    ...document.value,
    examples: examples.value.map((item, i) => (i === index ? next : item))
  }
}
function add() {
  rowKeys.value.push(crypto.randomUUID())
  document.value = {
    ...document.value,
    examples: [
      ...examples.value,
      { name: crypto.randomUUID(), title: '', description: '', values: {} }
    ]
  }
}
function referenceMedia(index: number, reference: Document | undefined) {
  if (!reference) return
  update(index, {
    reference_media: [
      ...arrayObjects(examples.value[index].reference_media),
      reference
    ]
  })
}
function remove(index: number) {
  emit('validity', `example:${rowKey(index)}`, true)
  rowKeys.value.splice(index, 1)
  document.value = {
    ...document.value,
    examples: examples.value.filter((_, i) => i !== index)
  }
}
</script>
<template>
  <section
    class="grid gap-4 rounded-2xl border border-admin-line bg-admin-card p-5"
  >
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-medium">{{ t('cmsEditor.examples') }}</h2>
      <AdminButton :icon="Plus" @click="add">{{
        t('cmsEditor.addExample')
      }}</AdminButton>
    </div>
    <p v-if="!examples.length" class="text-sm text-admin-muted">
      {{ t('cmsEditor.noExamples') }}
    </p>
    <div
      v-for="(example, index) in examples"
      :key="rowKey(index)"
      class="grid gap-4 rounded-lg border border-admin-line p-4"
    >
      <div class="flex justify-end">
        <AdminButton
          variant="dangerGhost"
          :icon="Trash2"
          :aria-label="t('cmsEditor.removeExample')"
          @click="remove(index)"
        />
      </div>
      <div class="grid gap-4 lg:grid-cols-2">
        <div class="grid gap-3">
          <label class="grid gap-1 text-sm text-admin-muted"
            >{{ t('cmsEditor.exampleTitle')
            }}<input
              :value="typeof example.title === 'string' ? example.title : ''"
              class="rounded-lg border border-admin-field bg-admin-page p-2 text-admin-fg"
              @input="patchText(index, 'title', $event)"
          /></label>
          <label class="grid gap-1 text-sm text-admin-muted"
            >{{ t('cmsEditor.description')
            }}<textarea
              :value="
                typeof example.description === 'string'
                  ? example.description
                  : ''
              "
              rows="3"
              class="rounded-lg border border-admin-field bg-admin-page p-2 text-admin-fg"
              @input="patchText(index, 'description', $event)"
            />
          </label>
          <JsonField
            :label="t('cmsEditor.exampleValues')"
            :value="objectValue(example.values)"
            :locale
            @validity="emit('validity', `example:${rowKey(index)}`, $event)"
            @update="update(index, { values: $event })"
          />
          <h3 class="text-sm">{{ t('cmsEditor.referenceMedia') }}</h3>
          <div
            v-for="(reference, refIndex) in arrayObjects(
              example.reference_media
            )"
            :key="refIndex"
            class="flex items-center justify-between gap-2 text-xs text-admin-muted"
          >
            <code class="break-all"
              >{{ reference.name }} · {{ reference.id }}</code
            ><AdminButton
              :aria-label="t('cmsEditor.detach')"
              :icon="Trash2"
              variant="dangerGhost"
              @click="
                update(index, {
                  reference_media: arrayObjects(example.reference_media).filter(
                    (_, i) => i !== refIndex
                  )
                })
              "
            />
          </div>
          <MediaUpload
            :entityUID
            :draft
            :csrf
            media-role="example-reference"
            :locale
            @update="referenceMedia(index, $event)"
            @busy="emit('busy', $event)"
          />
        </div>
        <div class="grid content-start gap-2">
          <h3 class="text-sm">{{ t('cmsEditor.exampleOutput') }}</h3>
          <MediaUpload
            :reference="example.media ? objectValue(example.media) : undefined"
            :entityUID
            :draft
            :csrf
            media-role="example-output"
            :locale
            @update="media(index, $event)"
            @busy="emit('busy', $event)"
          />
        </div>
      </div>
    </div>
    <p class="text-xs text-admin-muted">
      {{ t('cmsEditor.noPaidGeneration') }}
    </p>
  </section>
</template>
