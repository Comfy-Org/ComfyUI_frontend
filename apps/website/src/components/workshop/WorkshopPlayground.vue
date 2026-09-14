<script setup lang="ts">
import { useClipboard } from '@vueuse/core'
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from 'reka-ui'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

import { externalLinks } from '../../config/routes'
import type { WorkshopDetailModel } from '../../config/workshop-detail'
import { defaultWorkshopValues } from '../../config/workshop-detail'
import { parseWorkshopJsonInput } from '../../config/workshop-json-schema'
import {
  onBeforeSignInLeave,
  popWorkshopForm,
  stashWorkshopForm
} from '../../config/workshop-return'
import type { WorkshopSnippetLanguage } from '../../config/workshop-snippets'
import {
  WORKSHOP_SNIPPET_LANGUAGES,
  buildWorkshopInput,
  buildWorkshopSnippet,
  workshopIdempotencyKey
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
const stopStashing = onBeforeSignInLeave(() =>
  stashWorkshopForm(model.slug, model.fields, values.value)
)
onUnmounted(stopStashing)
const language = ref<WorkshopSnippetLanguage>('typescript')
// `legacy: true` on purpose. Without it `isSupported` is just the Clipboard
// API check, so on an insecure origin — a LAN-IP or staging preview, where
// `navigator.clipboard` is undefined — the button would be permanently
// disabled. With it, the helper falls back to `execCommand` and copying
// still works there. A bare `navigator.clipboard.writeText` would instead
// throw, and Vue would swallow the rejection, so the button would appear to
// do nothing at all.
const {
  copy,
  copied: copiedRecently,
  isSupported: canCopy
} = useClipboard({ copiedDuring: 1500, legacy: true })
/** Which language was on screen when the copy happened. */
const copiedLanguage = ref<WorkshopSnippetLanguage>()

/**
 * The request the snippet currently describes, serialized so it can be compared.
 * Only the body: the language a reader is reading it in is not part of what
 * would be sent, so switching tabs must not count as composing a new request.
 */
const requestBody = computed(() =>
  JSON.stringify(buildWorkshopInput(model.fields, values.value))
)

/**
 * One key per *composed request*, not per page load.
 *
 * The Router permits reuse only for a retry of the unchanged request; sending a
 * changed body under a key that has already been consumed conflicts, or replays
 * the earlier generation. So an edit has to mint a new one — otherwise a reader
 * who copies prompt A, edits to prompt B and copies again sends two distinct
 * paid requests under one key.
 *
 * Retries stay safe without any work here: the key is baked into the copied
 * text as a literal, so re-running that block always sends the key it was
 * copied with, whatever the form says by then.
 *
 * Minted in `onMounted` rather than in setup, and watched without `immediate`,
 * because setup also runs when Astro prerenders this island — a key made there
 * would be baked into the static HTML and shared by every visitor, so the
 * Router would read one reader's run as a repeat of another's. Until hydration
 * the snippet shows a placeholder, in the same spirit as the media URLs:
 * visibly not a real value, so a reader who somehow copied it that early gets a
 * request the Router rejects rather than one that silently collides.
 */
const idempotencyKey = ref('REPLACE-WITH-A-UUID')
onMounted(() => {
  idempotencyKey.value = workshopIdempotencyKey()
})
watch(requestBody, () => {
  idempotencyKey.value = workshopIdempotencyKey()
})

const snippet = computed(() =>
  buildWorkshopSnippet(
    language.value,
    model.id,
    model.fields,
    values.value,
    idempotencyKey.value
  )
)
const hasInvalidJson = computed(() =>
  model.fields.some((field) => {
    if (field.kind !== 'text' || field.valueType !== 'json') return false
    const value = values.value[field.name]
    return (
      typeof value === 'string' &&
      value !== '' &&
      !parseWorkshopJsonInput(value, field.jsonSchema).success
    )
  })
)

/**
 * A required field nobody has filled in. On first load that is most of the
 * catalog — 253 of 268 models are missing at least one, and 51 render a body
 * of `{}` — so copying then hands over a command that cannot run.
 */
const hasEmptyRequired = computed(() =>
  model.fields.some((field) => {
    if (!field.required) return false
    const value = values.value[field.name]
    return value === undefined || value === ''
  })
)

const canCopySnippet = computed(
  () => canCopy.value && !hasInvalidJson.value && !hasEmptyRequired.value
)

/**
 * Confirm only while the panel still shows what was copied. Switching
 * language replaces the snippet, so a lingering "Copied" would be claiming
 * something that never happened.
 *
 * Derived rather than reset: vueuse owns `copied` and exposes it readonly,
 * so assigning to it fails silently.
 */
const copied = computed(
  () => copiedRecently.value && copiedLanguage.value === language.value
)

async function copySnippet() {
  copiedLanguage.value = language.value
  await copy(snippet.value)
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
            :disabled="!canCopySnippet"
            class="text-primary-comfy-yellow text-sm hover:underline disabled:cursor-not-allowed disabled:opacity-50"
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
          <!--
            tabindex so a keyboard user can scroll a clipped snippet; an
            `overflow-auto` region is otherwise unreachable without a mouse.
            The active tab reuses the `snippet` computed rather than rebuilding
            it, so what is shown and what is copied cannot drift apart.
          -->
          <pre
            tabindex="0"
            class="focus-visible:ring-primary-comfy-yellow/50 mt-3 max-h-168 overflow-auto rounded-2xl border border-primary-comfy-canvas/10 bg-black p-6 text-sm/relaxed text-primary-comfy-canvas focus-visible:ring-2 focus-visible:outline-none"
          ><code>{{ option === language ? snippet : buildWorkshopSnippet(option, model.id, model.fields, values, idempotencyKey) }}</code></pre>
        </TabsContent>
      </TabsRoot>
      <a
        :href="externalLinks.apiKeys"
        target="_blank"
        rel="noopener noreferrer"
        class="text-primary-comfy-yellow mt-4 inline-flex text-sm font-medium hover:underline"
      >
        {{ t('workshop.model.getApiKey', locale) }}
      </a>
    </section>
  </div>
</template>
