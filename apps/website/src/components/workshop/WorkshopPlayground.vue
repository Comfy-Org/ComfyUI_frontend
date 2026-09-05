<script setup lang="ts">
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from 'reka-ui'
import { computed, onMounted, ref } from 'vue'

import type { WorkshopDetailModel } from '../../config/workshop-detail'
import { defaultWorkshopValues } from '../../config/workshop-detail'
import { popWorkshopForm } from '../../config/workshop-return'
import type { WorkshopSnippetLanguage } from '../../config/workshop-snippets'
import {
  WORKSHOP_SNIPPET_LANGUAGES,
  buildWorkshopSnippet
} from '../../config/workshop-snippets'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import WorkshopForm from './WorkshopForm.vue'

const { model, locale = 'en' } = defineProps<{
  model: WorkshopDetailModel
  locale?: Locale
}>()
const values = ref(defaultWorkshopValues(model.fields))

// A visitor coming back from sign-in or a purchase lands with the form they
// left; the stash is one-shot, so a plain visit costs one storage read.
onMounted(() => {
  const restored = popWorkshopForm(model.slug, model.fields)
  if (restored) values.value = { ...values.value, ...restored }
})
const language = ref<WorkshopSnippetLanguage>('typescript')
const copied = ref(false)
const snippet = computed(() =>
  buildWorkshopSnippet(language.value, model.id, model.fields, values.value)
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
  <div class="grid gap-8 lg:grid-cols-2">
    <WorkshopForm v-model="values" :model="model" :locale="locale" />

    <section>
      <TabsRoot v-model="language">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <TabsList
            :aria-label="t('workshop.model.codeLanguage', locale)"
            class="flex gap-1"
          >
            <TabsTrigger
              v-for="option in WORKSHOP_SNIPPET_LANGUAGES"
              :key="option"
              :value="option"
              class="focus-visible:ring-primary-comfy-yellow/50 data-[state=active]:bg-primary-comfy-yellow cursor-pointer rounded-full px-4 py-2 text-sm text-primary-comfy-canvas/65 transition-colors hover:text-primary-comfy-canvas focus-visible:ring-2 focus-visible:outline-none data-[state=active]:text-primary-comfy-ink"
            >
              {{ languageLabels[option] }}
            </TabsTrigger>
          </TabsList>
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
        <TabsContent
          v-for="option in WORKSHOP_SNIPPET_LANGUAGES"
          :key="option"
          :value="option"
        >
          <pre
            class="mt-3 max-h-168 overflow-auto rounded-2xl border border-primary-comfy-canvas/10 bg-black p-6 text-sm/relaxed text-primary-comfy-canvas"
          ><code>{{ buildWorkshopSnippet(option, model.id, model.fields, values) }}</code></pre>
        </TabsContent>
      </TabsRoot>
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
</template>
