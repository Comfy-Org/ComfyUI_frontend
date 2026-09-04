<script setup lang="ts">
import { computed, ref } from 'vue'

import type { WorkshopDetailModel } from '../../config/workshop-detail'
import { defaultWorkshopValues } from '../../config/workshop-detail'
import { runTargetFor } from '../../config/workshop-run-target'
import type { WorkshopSnippetLanguage } from '../../config/workshop-snippets'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import WorkshopForm from './WorkshopForm.vue'
import WorkshopRunPanel from './WorkshopRunPanel.vue'

const { model, locale = 'en' } = defineProps<{
  model: WorkshopDetailModel
  locale?: Locale
}>()
const runTarget = computed(() => runTargetFor(model))
const values = ref(defaultWorkshopValues(model.fields))
const language = ref<WorkshopSnippetLanguage>('typescript')
const copied = ref(false)
const snippet = computed(() =>
  runTarget.value.buildSnippet(language.value, model, values.value)
)

async function copySnippet() {
  await navigator.clipboard.writeText(snippet.value)
  copied.value = true
  window.setTimeout(() => {
    copied.value = false
  }, 1500)
}

const languageLabels: Record<WorkshopSnippetLanguage, string> = {
  typescript: 'TypeScript',
  python: 'Python',
  http: 'HTTP'
}
</script>

<template>
  <div>
    <div class="grid gap-8 lg:grid-cols-2">
      <WorkshopForm v-model="values" :model="model" :locale="locale" />

      <section>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div
            role="tablist"
            :aria-label="t('workshop.model.codeLanguage', locale)"
            class="flex gap-1"
          >
            <button
              v-for="option in runTarget.snippetLanguages"
              :key="option"
              type="button"
              role="tab"
              :aria-selected="language === option"
              class="rounded-full px-4 py-2 text-sm transition-colors"
              :class="
                language === option
                  ? 'bg-primary-comfy-yellow text-primary-comfy-ink'
                  : 'text-primary-comfy-canvas/65 hover:text-primary-comfy-canvas'
              "
              @click="language = option"
            >
              {{ languageLabels[option] }}
            </button>
          </div>
          <button
            type="button"
            class="text-primary-comfy-yellow text-sm hover:underline"
            @click="copySnippet"
          >
            {{
              copied
                ? t('workshop.model.copied', locale)
                : t('workshop.model.copy', locale)
            }}
          </button>
        </div>
        <pre
          class="mt-3 max-h-168 overflow-auto rounded-2xl border border-primary-comfy-canvas/10 bg-black p-6 text-sm/relaxed text-primary-comfy-canvas"
        ><code>{{ snippet }}</code></pre>
        <a
          href="https://platform.comfy.org/profile/api-keys"
          target="_blank"
          rel="noopener noreferrer"
          class="text-primary-comfy-yellow mt-4 inline-flex text-sm font-medium hover:underline"
        >
          {{ t('workshop.model.getApiKey', locale) }}
        </a>
      </section>
    </div>

    <WorkshopRunPanel :model="model" :values="values" :locale="locale" />
  </div>
</template>
