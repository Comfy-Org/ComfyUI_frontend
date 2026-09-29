<script setup lang="ts">
import { computed, ref } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import Button from '@/components/ui/button/Button.vue'
import CopyTextButton from '@/components/ui/copy-text-button/CopyTextButton.vue'
import { useTablist } from '../../composables/useTablist'
import type { WorkflowWorkshopModelDetail } from '../../config/models-catalogue'
import type { SnippetLanguage } from '../../config/models-snippets'
import { SNIPPET_LANGUAGES } from '../../config/models-snippets'
import { apiKeysLink, externalLinks } from '../../config/routes'
import type { FormValues } from '../../config/workshop-playground'
import { urlUploadField } from '../../config/workshop-playground'
import { initialWorkshopPageState } from '../../config/workshop-page-state'
import { useWorkshopSession } from '../../config/workshop-session-state'
import { WORKSHOP_CLOUD_BASE_URL } from '../../config/workshop-env'
import { workspaceLinkedHref } from '../../config/workshop-workspace-link'
import {
  workflowCurl,
  workflowPython,
  workflowSdkPlan,
  workflowSnippetRequest,
  workflowTypeScript
} from '../../config/workshop-workflow-snippet'
import { t } from '../../i18n/translations'
import type { CodeLang } from '../../lib/highlight'
import HighlightedCode from './HighlightedCode.vue'

const { model, values } = defineProps<{
  model: WorkflowWorkshopModelDetail
  values: FormValues
}>()
const { session } = useWorkshopSession()
const keyHref = computed(() =>
  workspaceLinkedHref(
    apiKeysLink({ onboarding: 'models', model: model.slug }),
    session.value?.workspace.id
  )
)
const request = computed(() => {
  if (model.type !== 'CLOUD') return undefined
  try {
    return workflowSnippetRequest(model, values)
  } catch {
    return undefined
  }
})
const language = ref<SnippetLanguage>('python')
const { onKeydown: onLanguageKeydown } = useTablist(
  () => SNIPPET_LANGUAGES,
  language
)
const code = computed(() => {
  if (!request.value) return ''
  if (language.value === 'curl') return workflowCurl(request.value)
  const plan = workflowSdkPlan(model, values, request.value)
  return language.value === 'python'
    ? workflowPython(plan)
    : workflowTypeScript(plan)
})
const languageLabel: Record<SnippetLanguage, string> = {
  python: 'Python',
  typescript: 'TypeScript',
  curl: 'cURL'
}
const highlightLanguage = {
  python: 'python',
  typescript: 'typescript',
  curl: 'shell'
} satisfies Record<SnippetLanguage, CodeLang>
const hasMedia = initialWorkshopPageState(model).schema.some((field) =>
  urlUploadField(field)
)
const endpoint = `${WORKSHOP_CLOUD_BASE_URL}/api/prompt`
</script>

<template>
  <section class="space-y-6" aria-labelledby="workflow-api-heading">
    <div class="space-y-2">
      <h2
        id="workflow-api-heading"
        class="text-2xl font-light text-primary-comfy-canvas"
      >
        {{ t('workshop.api.heading') }}
      </h2>
      <p class="max-w-3xl text-sm/relaxed text-primary-warm-gray">
        {{ t('workshop.workflow.apiHint') }}
      </p>
    </div>
    <div
      class="flex flex-col gap-3 rounded-2xl border border-transparency-white-t20 p-5"
      data-testid="workflow-api-endpoint"
    >
      <div
        v-if="language === 'curl'"
        class="flex flex-wrap items-center gap-3 text-sm"
      >
        <span
          class="rounded-md bg-primary-comfy-yellow px-2 py-1 font-mono text-primary-comfy-ink"
          >POST</span
        >
        <code class="min-w-0 break-all text-primary-warm-white">{{
          endpoint
        }}</code>
      </div>
      <p class="text-sm/relaxed text-primary-warm-gray">
        {{ t('workshop.workflow.apiNote') }}
      </p>
    </div>
    <div
      v-if="code"
      class="overflow-hidden rounded-2xl border border-transparency-white-t20"
    >
      <div
        class="flex items-center justify-between border-b border-transparency-white-t8 px-3 py-2"
      >
        <div
          role="tablist"
          :aria-label="t('workshop.api.heading')"
          class="flex gap-1"
          @keydown="onLanguageKeydown"
        >
          <button
            v-for="option in SNIPPET_LANGUAGES"
            :id="`workflow-snippet-tab-${option}`"
            :key="option"
            type="button"
            role="tab"
            :aria-selected="language === option"
            aria-controls="workflow-api-snippet"
            :tabindex="language === option ? 0 : -1"
            :class="
              cn(
                'cursor-pointer rounded-xl px-3 py-1.5 text-xs font-bold tracking-wider uppercase transition-colors',
                language === option
                  ? 'bg-primary-comfy-yellow text-primary-comfy-ink'
                  : 'text-primary-comfy-canvas hover:bg-transparency-white-t8 hover:text-primary-warm-white'
              )
            "
            @click="language = option"
          >
            {{ languageLabel[option] }}
          </button>
        </div>
        <CopyTextButton
          :value="code"
          :label="t('workshop.api.copy')"
          :copied-label="t('workshop.api.copied')"
        />
      </div>
      <pre
        id="workflow-api-snippet"
        role="tabpanel"
        :aria-labelledby="`workflow-snippet-tab-${language}`"
        tabindex="0"
        class="max-h-168 overflow-auto bg-primary-comfy-ink p-6 text-sm/relaxed text-primary-warm-white"
        data-testid="workflow-api-snippet"
      ><HighlightedCode :code="code" :language="highlightLanguage[language]" /></pre>
    </div>
    <p v-else role="status" class="text-sm text-primary-warm-gray">
      {{ t('workshop.api.inputInvalid') }}
    </p>
    <template v-if="language === 'curl'">
      <div
        v-if="hasMedia"
        class="max-w-3xl space-y-2 text-sm/relaxed text-primary-warm-gray"
      >
        <h3 class="font-medium text-primary-comfy-canvas">
          {{ t('workshop.workflow.apiUploads') }}
        </h3>
        <p>{{ t('workshop.workflow.apiUploadGrant') }}</p>
        <p>{{ t('workshop.workflow.apiUploadPut') }}</p>
        <p>{{ t('workshop.workflow.apiUploadFinalize') }}</p>
      </div>
      <p class="max-w-3xl text-sm/relaxed text-primary-warm-gray">
        {{ t('workshop.workflow.apiPoll') }}
      </p>
    </template>
    <div class="flex flex-wrap gap-3">
      <Button as="a" :href="keyHref" target="_blank" rel="noopener">{{
        t('workshop.api.getKey')
      }}</Button>
      <Button
        as="a"
        :href="externalLinks.docsApi"
        target="_blank"
        rel="noopener"
        variant="outline"
        >{{ t('workshop.workflow.apiDocs') }}</Button
      >
    </div>
  </section>
</template>
