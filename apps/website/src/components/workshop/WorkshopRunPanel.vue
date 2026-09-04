<script setup lang="ts">
import { onMounted, ref, shallowRef } from 'vue'

import type {
  WorkshopDetailModel,
  WorkshopFormValues
} from '../../config/workshop-detail'
import {
  readStoredCredentials,
  writeStoredCredentials
} from '../../config/workshop-credentials'
import type {
  WorkshopRunErrorType,
  WorkshopRunResult
} from '../../config/workshop-run'
import { WORKSHOP_RUN_TIMEOUT_MS } from '../../config/workshop-run'
import {
  extractMediaUrls,
  mediaKindForModality
} from '../../config/workshop-results'
import { runTargetFor } from '../../config/workshop-run-target'
import type { Locale, TranslationKey } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const {
  model,
  values,
  locale = 'en'
} = defineProps<{
  model: WorkshopDetailModel
  values: WorkshopFormValues
  locale?: Locale
}>()

const credentials = ref('')
const running = ref(false)
// shallowRef: this holds a partner's JSON document of unknown size and we
// only ever replace it wholesale, so there is nothing to gain from making
// every node in it reactive.
const result = shallowRef<WorkshopRunResult | undefined>(undefined)
const mediaUrls = shallowRef<readonly string[]>([])
let controller: AbortController | undefined

// Read on mount rather than at setup: this component is server-rendered for
// the static page, where localStorage does not exist.
onMounted(() => {
  credentials.value = readStoredCredentials()
})

const mediaKind = mediaKindForModality(model.modality)

/**
 * Headings for the failures a visitor can act on. Everything else falls back
 * to a generic heading with Router's own `detail` underneath, rather than us
 * inventing prose for a bucket we have nothing useful to say about.
 */
const errorHeadings: Partial<Record<WorkshopRunErrorType, TranslationKey>> = {
  unauthorized: 'workshop.run.error.unauthorized',
  forbidden: 'workshop.run.error.unauthorized',
  insufficient_credits: 'workshop.run.error.insufficientCredits',
  rate_limited: 'workshop.run.error.rateLimited',
  concurrency_limit_exceeded: 'workshop.run.error.rateLimited',
  content_policy_violation: 'workshop.run.error.contentPolicy',
  not_enabled: 'workshop.run.error.notEnabled',
  invalid_input: 'workshop.run.error.invalidInput',
  deadline_exceeded: 'workshop.run.error.timeout',
  provider_timeout: 'workshop.run.error.timeout',
  network_error: 'workshop.run.error.network'
}

function headingFor(errorType: WorkshopRunErrorType): string {
  return t(errorHeadings[errorType] ?? 'workshop.run.error.generic', locale)
}

async function run() {
  if (credentials.value === '' || running.value) return
  writeStoredCredentials(credentials.value)
  running.value = true
  result.value = undefined
  mediaUrls.value = []

  controller = new AbortController()
  const timeout = window.setTimeout(
    () => controller?.abort(),
    WORKSHOP_RUN_TIMEOUT_MS
  )
  try {
    const outcome = await runTargetFor(model).run(model, values, {
      credentials: credentials.value,
      signal: controller.signal
    })
    result.value = outcome
    if (outcome.status === 'ok') {
      mediaUrls.value = extractMediaUrls(outcome.output)
    }
  } finally {
    window.clearTimeout(timeout)
    controller = undefined
    running.value = false
  }
}

function cancel() {
  controller?.abort()
}
</script>

<template>
  <section class="mt-12 border-t border-primary-comfy-canvas/10 pt-10">
    <h2 class="text-2xl font-semibold text-primary-comfy-canvas">
      {{ t('workshop.run.heading', locale) }}
    </h2>

    <div class="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end">
      <label class="flex min-w-0 flex-1 flex-col gap-2">
        <span class="text-sm font-medium text-primary-comfy-canvas">
          {{ t('workshop.run.apiKey', locale) }}
        </span>
        <input
          v-model="credentials"
          type="password"
          autocomplete="off"
          spellcheck="false"
          :placeholder="t('workshop.run.apiKeyPlaceholder', locale)"
          class="focus:border-primary-comfy-yellow h-11 rounded-xl border border-primary-comfy-canvas/15 bg-primary-comfy-canvas/5 px-4 font-mono text-sm text-primary-comfy-canvas outline-none"
        />
      </label>
      <button
        v-if="!running"
        type="button"
        :disabled="credentials === ''"
        class="hover:bg-primary-comfy-yellow/90 h-11 shrink-0 rounded-xl bg-primary-comfy-yellow px-8 font-medium text-primary-comfy-ink transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        @click="run"
      >
        {{ t('workshop.run.button', locale) }}
      </button>
      <button
        v-else
        type="button"
        class="hover:border-primary-comfy-canvas/40 h-11 shrink-0 rounded-xl border border-primary-comfy-canvas/25 px-8 text-primary-comfy-canvas transition-colors"
        @click="cancel"
      >
        {{ t('workshop.run.cancel', locale) }}
      </button>
    </div>

    <p class="mt-3 text-sm text-primary-comfy-canvas/55">
      {{ t('workshop.run.keyNote', locale) }}
      <a
        href="https://platform.comfy.org/profile/api-keys"
        target="_blank"
        rel="noopener noreferrer"
        class="text-primary-comfy-yellow hover:underline"
      >
        {{ t('workshop.model.getApiKey', locale) }}
      </a>
    </p>

    <p
      v-if="running"
      class="mt-8 text-sm text-primary-comfy-canvas/70"
      aria-live="polite"
    >
      {{ t('workshop.run.running', locale) }}
    </p>

    <div
      v-else-if="result?.status === 'error'"
      class="mt-8 rounded-2xl border border-red-500/30 bg-red-500/5 p-6"
      role="alert"
    >
      <p class="font-medium text-primary-comfy-canvas">
        {{ headingFor(result.errorType) }}
      </p>
      <p class="mt-2 text-sm whitespace-pre-line text-primary-comfy-canvas/70">
        {{ result.detail }}
      </p>
      <p
        v-if="result.requestId"
        class="mt-3 font-mono text-xs text-primary-comfy-canvas/45"
      >
        {{ t('workshop.run.requestId', locale) }} {{ result.requestId }}
      </p>
    </div>

    <div v-else-if="result?.status === 'ok'" class="mt-8">
      <ul
        v-if="mediaUrls.length > 0"
        class="grid list-none grid-cols-1 gap-4 p-0 md:grid-cols-2"
      >
        <li
          v-for="url in mediaUrls"
          :key="url"
          class="overflow-hidden rounded-2xl border border-primary-comfy-canvas/10 bg-primary-comfy-canvas/5"
        >
          <img
            v-if="mediaKind === 'image'"
            :src="url"
            :alt="model.displayName"
            class="w-full"
          />
          <video
            v-else-if="mediaKind === 'video'"
            :src="url"
            controls
            playsinline
            class="w-full"
          />
          <audio
            v-else-if="mediaKind === 'audio'"
            :src="url"
            controls
            class="w-full p-4"
          />
          <a
            v-else
            :href="url"
            target="_blank"
            rel="noopener noreferrer"
            class="text-primary-comfy-yellow block p-6 text-sm break-all hover:underline"
          >
            {{ url }}
          </a>
        </li>
      </ul>

      <p v-else class="text-sm text-primary-comfy-canvas/65">
        {{ t('workshop.run.noMedia', locale) }}
      </p>

      <!--
        Always available, never only. The output shape belongs to the partner,
        so whatever the list above found, the document itself is the record of
        what actually came back.
      -->
      <details class="mt-4">
        <summary
          class="cursor-pointer text-sm text-primary-comfy-canvas/65 hover:text-primary-comfy-canvas"
        >
          {{ t('workshop.run.rawOutput', locale) }}
        </summary>
        <pre
          class="mt-3 max-h-120 overflow-auto rounded-2xl border border-primary-comfy-canvas/10 bg-black p-6 text-sm/relaxed text-primary-comfy-canvas"
        ><code>{{ JSON.stringify(result.output, null, 2) }}</code></pre>
      </details>
    </div>
  </section>
</template>
