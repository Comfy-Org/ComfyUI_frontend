<script setup lang="ts">
import AdminButton from '@/components/cms/ui/AdminButton.vue'
import type { Document } from '@/lib/cms/editor-document'
import { arrayObjects } from '@/lib/cms/editor-document'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
const { locale, invalid } = defineProps<{ locale: Locale; invalid: boolean }>()
const document = defineModel<Document>({ required: true })
const emit = defineEmits<{ validity: [valid: boolean] }>()
const t = translationsFor(locale).t
const inputClass =
  'w-full rounded-lg border border-admin-field bg-admin-page px-3 py-2 text-sm text-admin-fg outline-none focus:border-primary-comfy-yellow'
function faqValue(index: number, name: string) {
  const raw = arrayObjects(document.value.faq)[index]?.[name]
  return typeof raw === 'string' ? raw : ''
}
function updateFaq(next: Document) {
  document.value = next
  const questions = new Set<string>()
  const valid = arrayObjects(next.faq).every((entry) => {
    const question =
      typeof entry.question === 'string'
        ? entry.question.trim().toLowerCase()
        : ''
    const answer = typeof entry.answer === 'string' ? entry.answer.trim() : ''
    if (!question || !answer || questions.has(question)) return false
    questions.add(question)
    return true
  })
  emit('validity', valid)
}
function faq(index: number, name: string, event: Event) {
  if (
    !(
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement
    )
  )
    return
  const value = event.target.value
  updateFaq({
    ...document.value,
    faq: arrayObjects(document.value.faq).map((item, at) =>
      at === index ? { ...item, [name]: value } : item
    )
  })
}
function addFaq() {
  updateFaq({
    ...document.value,
    faq: [...arrayObjects(document.value.faq), { question: '', answer: '' }]
  })
}
function removeFaq(index: number) {
  updateFaq({
    ...document.value,
    faq: arrayObjects(document.value.faq).filter((_, at) => at !== index)
  })
}
</script>
<template>
  <section
    class="grid gap-4 rounded-2xl border border-admin-line bg-admin-card p-5"
  >
    <div class="flex items-center justify-between gap-3">
      <h2 class="text-lg font-medium">{{ t('cccMetadata.faq') }}</h2>
      <AdminButton @click="addFaq">{{
        t('cccMetadata.addQuestion')
      }}</AdminButton>
    </div>
    <p v-if="invalid" class="text-sm text-admin-danger-text">
      {{ t('cccMetadata.invalidFAQ') }}
    </p>
    <div
      v-for="(_, index) in arrayObjects(document.faq)"
      :key="index"
      class="grid gap-3 rounded-lg border border-admin-line p-4"
    >
      <label class="grid gap-1 text-sm text-admin-muted"
        >{{ t('cccMetadata.question', { count: index + 1 })
        }}<input
          :value="faqValue(index, 'question')"
          maxlength="300"
          :class="inputClass"
          @input="faq(index, 'question', $event)"
      /></label>
      <label class="grid gap-1 text-sm text-admin-muted"
        >{{ t('cccMetadata.answer', { count: index + 1 })
        }}<textarea
          :value="faqValue(index, 'answer')"
          rows="5"
          maxlength="20000"
          :class="inputClass"
          @input="faq(index, 'answer', $event)"
        />
      </label>
      <AdminButton @click="removeFaq(index)">{{
        t('cccMetadata.removeQuestion')
      }}</AdminButton>
    </div>
  </section>
</template>
