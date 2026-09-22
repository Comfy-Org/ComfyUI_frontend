<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import Button from '@/components/ui/button/Button.vue'
import CopyTextButton from '@/components/ui/copy-text-button/CopyTextButton.vue'
import { apiKeysLink, externalLinks } from '../../config/routes'
import type { FileValue, FormValues } from '../../config/workshop-playground'
import { schemaForModel } from '../../config/workshop-playground'
import { formForContract } from '../../config/workshop-contract'
import { workshopExampleFile } from '../../config/workshop-example-file'
import { shouldRehostWorkshopUrl } from '../../config/workshop-url-input'
import type { SnippetFile, SnippetLanguage } from '../../config/models-snippets'
import {
  SNIPPET_LANGUAGES,
  buildSnippet,
  hasOmittedCurlFiles
} from '../../config/models-snippets'
import type { WorkshopContract } from '../../config/workshop-contract'
import { prepareWorkshopRouterInput } from '../../config/workshop-request'
import { WorkshopRouterError } from '../../config/workshop-router-errors'
import { workshopIdempotencyKey } from '../../config/workshop-snippets'
import type { Locale } from '../../i18n/translations'
import { useTablist } from '../../composables/useTablist'
import { t } from '../../i18n/translations'
import type { CodeLang } from '../../lib/highlight'
import HighlightedCode from './HighlightedCode.vue'

const {
  contract,
  values,
  locale = 'en',
  modelSlug
} = defineProps<{
  contract?: WorkshopContract
  values: FormValues
  locale?: Locale
  modelSlug?: string
}>()

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

const showFileNotice = computed(() => {
  if (!request.value) return false
  const { body, files } = request.value
  return language.value === 'curl'
    ? hasOmittedCurlFiles(body, files)
    : files.some((file) => !file.sourceUrl)
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
</script>

<template>
  <section class="flex flex-col gap-6" data-testid="api-tab">
    <div class="flex flex-col gap-2">
      <h2 class="text-2xl font-bold text-primary-comfy-canvas">
        {{ t('workshop.api.heading', locale) }}
      </h2>
      <p class="text-sm text-primary-warm-gray">
        {{ t('workshop.api.body', locale) }}
      </p>
    </div>

    <div
      v-if="snippet"
      class="overflow-hidden rounded-2xl border border-transparency-white-t20 bg-transparency-white-t4"
    >
      <div
        class="flex items-center justify-between border-b border-transparency-white-t8 px-3 py-2"
      >
        <div
          role="tablist"
          :aria-label="t('workshop.api.heading', locale)"
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
          :label="t('workshop.api.copy', locale)"
          :copied-label="t('workshop.api.copied', locale)"
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
              : 'workshop.api.localFiles',
            locale
          )
        }}
      </p>
      <pre
        id="snippet-panel"
        role="tabpanel"
        :aria-labelledby="`snippet-tab-${language}`"
        tabindex="0"
        class="overflow-x-auto bg-primary-comfy-ink p-6 font-mono text-sm/relaxed text-primary-warm-white"
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
            : 'workshop.api.inputInvalid',
          locale
        )
      }}
    </p>

    <div class="flex flex-wrap gap-3">
      <Button
        as="a"
        :href="apiKeysLink({ onboarding: 'models', model: modelSlug })"
        target="_blank"
        rel="noopener noreferrer"
        data-testid="api-get-key"
      >
        {{ t('workshop.api.getKey', locale) }}
      </Button>
      <Button
        as="a"
        variant="outline"
        :href="externalLinks.docsComfyRouter"
        target="_blank"
        rel="noopener noreferrer"
      >
        {{ t('workshop.api.docs', locale) }}
      </Button>
    </div>
  </section>
</template>
