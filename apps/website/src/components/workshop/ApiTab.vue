<script setup lang="ts">
import { ArrowUpRight, KeyRound } from '@lucide/vue'
import { computed, ref, watch } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import Button from '@/components/ui/button/Button.vue'
import Card from '@/components/ui/card/Card.vue'
import CopyTextButton from '@/components/ui/copy-text-button/CopyTextButton.vue'
import CopyableField from '@/components/ui/copyable-field/CopyableField.vue'
import { apiKeysLink, externalLinks } from '@/config/routes'
import type { FileValue, FormValues } from '@/config/workshop-playground'
import { schemaForModel } from '@/config/workshop-playground'
import { formForContract } from '@/config/workshop-contract'
import { workshopExampleFile } from '@/config/workshop-example-file'
import { shouldRehostWorkshopUrl } from '@/config/workshop-url-input'
import type { SnippetFile, SnippetLanguage } from '@/config/models-snippets'
import {
  MODEL_SDK_INSTALL,
  SNIPPET_LANGUAGES,
  buildSnippet,
  hasOmittedCurlFiles
} from '@/config/models-snippets'
import type { WorkshopContract } from '@/config/workshop-contract'
import { prepareWorkshopRouterInput } from '@/config/workshop-request'
import { WorkshopRouterError } from '@/config/workshop-router-errors'
import { workshopIdempotencyKey } from '@/config/workshop-snippets'
import { workspaceLinkedHref } from '@/config/workshop-workspace-link'
import type { Locale } from '@/i18n/translations'
import { useTablist } from '@/composables/useTablist'
import { translationsFor } from '@/i18n/translations'
import type { CodeLang } from '@/lib/highlight'
import ApiStep from './ApiStep.vue'
import HighlightedCode from './HighlightedCode.vue'

const {
  contract,
  values,
  workspaceId,
  locale = 'en',
  modelSlug,
  docsHref
} = defineProps<{
  contract?: WorkshopContract
  values: FormValues
  workspaceId?: string
  locale?: Locale
  modelSlug?: string
  docsHref?: string
}>()
const { t } = translationsFor(locale)

const emit = defineEmits<{ copy: [language: SnippetLanguage]; getKey: [] }>()

const apiKeyHref = computed(() =>
  workspaceLinkedHref(
    apiKeysLink({ onboarding: 'models', model: modelSlug }),
    workspaceId
  )
)

const language = ref<SnippetLanguage>('python')
const { onKeydown: onLanguageKeydown } = useTablist(
  () => SNIPPET_LANGUAGES,
  language
)
const request = ref<{
  body: Readonly<Record<string, unknown>>
  files: readonly SnippetFile[]
}>()
const fileReferences = new WeakMap<
  File,
  Partial<Record<'base64' | 'url', SnippetFile>>
>()

function referenceFor(file: File, encoding: 'base64' | 'url'): SnippetFile {
  const references = fileReferences.get(file) ?? {}
  let reference = references[encoding]
  if (!reference) {
    const id = workshopIdempotencyKey()
    reference = {
      token: encoding === 'url' ? `https://upload.invalid/${id}` : btoa(id),
      name: file.name,
      mimeType: file.type,
      encoding
    }
    references[encoding] = reference
    fileReferences.set(file, references)
  }
  return reference
}
const unavailable = ref(false)

function previewValues(
  values: FormValues,
  sources: WeakMap<File, Pick<FileValue, 'sourceUrl'>>
): FormValues {
  function preview(value: FileValue): FileValue {
    if (value.file || !value.sourceUrl) return value
    const file = new File([], value.name, { type: value.type })
    sources.set(file, { sourceUrl: value.sourceUrl })
    return { ...value, file }
  }
  const fields = contract?.rehostUrlInputs
    ? schemaForModel({ fields: [], form: formForContract(contract) })
    : []
  return Object.fromEntries(
    Object.entries(values).map(([name, value]) => {
      const field = fields.find((field) => field.name === name)
      if (field && shouldRehostWorkshopUrl(field, value)) {
        const example = workshopExampleFile(value)
        if (example) return [name, preview(example)]
      }
      return [
        name,
        Array.isArray(value)
          ? value.map(preview)
          : value && typeof value === 'object'
            ? preview(value)
            : value
      ]
    })
  )
}
watch(
  [() => contract, () => values],
  async (_, __, onCleanup) => {
    const controller = new AbortController()
    onCleanup(() => controller.abort())
    request.value = undefined
    unavailable.value = false
    try {
      const files: SnippetFile[] = []
      const sources = new WeakMap<File, Pick<FileValue, 'sourceUrl'>>()
      function addReference(file: File, encoding: 'base64' | 'url') {
        const reference = referenceFor(file, encoding)
        if (!files.some((entry) => entry.token === reference.token))
          files.push({
            ...reference,
            ...sources.get(file),
            rehost: contract?.rehostUrlInputs,
            urlAlternative:
              contract?.creator?.request.kind === 'callback' &&
              ['seedream', 'seedance', 'runway-image'].includes(
                contract.creator.request.callback
              )
          })
        return reference.token
      }
      const body = await prepareWorkshopRouterInput(
        contract,
        previewValues(values, sources),
        controller.signal,
        (file, signal) => {
          signal.throwIfAborted()
          return Promise.resolve(addReference(file, 'base64'))
        },
        (file, signal) => {
          signal.throwIfAborted()
          return Promise.resolve(addReference(file, 'url'))
        }
      )
      controller.signal.throwIfAborted()
      request.value = { body, files }
    } catch (error) {
      if (controller.signal.aborted) return
      unavailable.value =
        error instanceof WorkshopRouterError && error.reason === 'unavailable'
    }
  },
  { immediate: true }
)
const snippet = computed(() =>
  request.value && contract
    ? buildSnippet(language.value, contract.id, request.value.body, {
        files: request.value.files,
        output:
          contract.output.format === 'json' ||
          (contract.output.format === 'auto' &&
            contract.output.contentTypes.includes('application/json') &&
            contract.output.contentTypes.every(
              (type) => type.includes('json') || type === 'text/event-stream'
            ))
            ? 'json'
            : 'binary'
      })
    : ''
)

const hasLocalFiles = computed(() =>
  Boolean(request.value?.files.some((file) => !file.sourceUrl))
)
const showFileNotice = computed(() => {
  if (!request.value) return false
  const { body, files } = request.value
  return language.value === 'curl'
    ? hasOmittedCurlFiles(body, files)
    : hasLocalFiles.value
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

const endpoint = computed(() =>
  contract ? `POST /v2/models/${contract.id}` : undefined
)
</script>

<template>
  <Card
    class="gap-8 max-sm:rounded-none max-sm:bg-transparent max-sm:shadow-none sm:p-8 lg:p-10"
    data-testid="api-tab"
  >
    <div class="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-1">
      <div class="flex max-w-3xl flex-col gap-3">
        <h2
          id="api-heading"
          class="text-3xl/tight font-light text-primary-warm-white lg:text-4xl/tight"
        >
          {{ t('workshop.api.heading') }}
        </h2>
        <p class="text-base/relaxed text-primary-comfy-canvas">
          {{ t('workshop.api.body') }}
        </p>
      </div>
      <a
        :href="docsHref ?? externalLinks.docsComfyRouter"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary-comfy-yellow transition-opacity hover:opacity-80"
        data-testid="model-docs-link"
      >
        {{ t('hubPages.workflow.apiDocs') }}
        <span class="sr-only">{{ t('workshop.workflow.opensInNewTab') }}</span>
        <ArrowUpRight class="size-4" aria-hidden="true" />
      </a>
    </div>

    <div class="flex flex-col gap-8 lg:gap-6">
      <ol class="flex flex-col gap-6">
        <ApiStep
          :step="1"
          :title="t('hubPages.workflow.getApiKey')"
          :body="t('workshop.workflow.apiStepKeyBody')"
          current
        >
          <Button
            as="a"
            :href="apiKeyHref"
            target="_blank"
            rel="noopener noreferrer"
            variant="secondaryOutline"
            class="px-5"
            data-testid="api-get-key"
            @click="emit('getKey')"
          >
            <template #prepend>
              <KeyRound class="size-4" aria-hidden="true" />
            </template>
            {{ t('hubPages.workflow.getApiKey') }}
            <span class="sr-only">{{
              t('workshop.workflow.opensInNewTab')
            }}</span>
          </Button>
        </ApiStep>
        <ApiStep
          :step="2"
          :title="t('workshop.workflow.apiStepSdk')"
          :body="t('workshop.workflow.apiStepSdkBody')"
        >
          <CopyableField
            :value="MODEL_SDK_INSTALL"
            :copy-label="t('workshop.workflow.apiCopyInstall')"
            :copied-label="t('workshop.api.copied')"
            class="h-10 w-full py-0 lg:w-80"
          />
        </ApiStep>
        <ApiStep
          :step="3"
          :title="t('workshop.workflow.apiStepRun')"
          :body="t('workshop.api.stepRunBody')"
        >
          <CopyableField
            v-if="endpoint"
            :value="endpoint"
            :copy-label="t('workshop.api.copyEndpoint')"
            :copied-label="t('workshop.api.copied')"
            class="h-10 w-full py-0 lg:w-80"
            data-testid="api-endpoint"
          />
        </ApiStep>
      </ol>

      <div class="flex min-w-0 flex-col gap-4">
        <div
          v-if="snippet"
          class="overflow-hidden rounded-2xl border border-transparency-white-t20 bg-transparency-white-t4"
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
                :id="`snippet-tab-${option}`"
                :key="option"
                type="button"
                role="tab"
                :aria-selected="language === option"
                aria-controls="snippet-panel"
                :tabindex="language === option ? 0 : -1"
                :data-testid="`snippet-${option}`"
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
              :value="snippet"
              :label="t('workshop.api.copy')"
              :copied-label="t('workshop.api.copied')"
              @click="emit('copy', language)"
            />
          </div>
          <p
            v-if="showFileNotice"
            role="note"
            class="px-6 pt-4 text-sm text-primary-warm-gray"
          >
            {{
              t(
                language === 'curl'
                  ? 'workshop.api.filesOmitted'
                  : 'workshop.api.localFiles'
              )
            }}
          </p>
          <pre
            id="snippet-panel"
            role="tabpanel"
            :aria-labelledby="`snippet-tab-${language}`"
            tabindex="0"
            class="max-h-120 overflow-auto bg-primary-comfy-ink p-6 font-mono text-sm/relaxed text-primary-warm-white"
            data-testid="snippet"
          ><HighlightedCode
              :code="snippet"
              :language="highlightLanguage[language]"
            /></pre>
        </div>

        <p v-if="!snippet" role="status" class="text-sm text-primary-warm-gray">
          {{
            t(
              unavailable
                ? 'workshop.api.mappingUnavailable'
                : 'workshop.api.inputInvalid'
            )
          }}
        </p>
      </div>
    </div>
  </Card>
</template>
