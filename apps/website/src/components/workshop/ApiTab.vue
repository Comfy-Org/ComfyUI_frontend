<script setup lang="ts">
import { ArrowUpRight } from '@lucide/vue'
import { computed, ref, watch } from 'vue'

import Card from '@/components/ui/card/Card.vue'
import { apiKeysLink, externalLinks } from '@/config/routes'
import type { FileValue, FormValues } from '@/config/workshop-playground'
import { schemaForModel } from '@/config/workshop-playground'
import { formForContract } from '@/config/workshop-contract'
import { workshopExampleFile } from '@/config/workshop-example-file'
import { shouldRehostWorkshopUrl } from '@/config/workshop-url-input'
import type { SnippetFile, SnippetLanguage } from '@/config/models-snippets'
import { buildSnippet, hasOmittedCurlFiles } from '@/config/models-snippets'
import type { WorkshopContract } from '@/config/workshop-contract'
import { prepareWorkshopRouterInput } from '@/config/workshop-request'
import { WorkshopRouterError } from '@/config/workshop-router-errors'
import { workshopIdempotencyKey } from '@/config/workshop-snippets'
import { workspaceLinkedHref } from '@/config/workshop-workspace-link'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import ModelApiSteps from './ModelApiSteps.vue'
import ModelSnippetPanel from './ModelSnippetPanel.vue'

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
      <ModelApiSteps
        :api-key-href="apiKeyHref"
        :endpoint="endpoint"
        :locale="locale"
        @get-key="emit('getKey')"
      />

      <div class="flex min-w-0 flex-col gap-4">
        <ModelSnippetPanel
          v-if="snippet"
          v-model:language="language"
          :snippet="snippet"
          :file-notice="showFileNotice"
          :locale="locale"
          @copy="emit('copy', $event)"
        />

        <p v-else role="status" class="text-sm text-primary-warm-gray">
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
