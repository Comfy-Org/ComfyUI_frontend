<script setup lang="ts">
import { ref, watch } from 'vue'

import { useWorkshopCredentials } from '../../config/workshop-credentials-state'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { open, locale = 'en' } = defineProps<{
  open: boolean
  locale?: Locale
}>()
const emit = defineEmits<{ close: []; authenticated: [] }>()

const { credentials, save } = useWorkshopCredentials()
const draft = ref('')
const dialog = ref<HTMLDialogElement>()

watch(
  () => open,
  (isOpen) => {
    if (isOpen) {
      draft.value = credentials.value
      // showModal, not an overlay div: it gets focus trapping, Escape, and
      // inertness of the rest of the page from the platform for free.
      dialog.value?.showModal()
    } else {
      dialog.value?.close()
    }
  }
)

function submit() {
  if (draft.value === '') return
  save(draft.value)
  emit('authenticated')
  emit('close')
}
</script>

<template>
  <dialog
    ref="dialog"
    class="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-primary-comfy-canvas/15 bg-primary-comfy-ink p-0 text-primary-comfy-canvas backdrop:bg-black/60"
    :aria-label="t('workshop.auth.heading', locale)"
    @close="emit('close')"
  >
    <form class="p-6" @submit.prevent="submit">
      <h2 class="text-xl font-semibold">
        {{ t('workshop.auth.heading', locale) }}
      </h2>
      <p class="mt-2 text-sm text-primary-comfy-canvas/65">
        {{ t('workshop.auth.body', locale) }}
      </p>

      <!--
        Scaffolding. In the shipped product this dialog is a sign-in flow and
        there is no key field: comfy.org cannot start a session yet because
        the origin is not on the Firebase authorized-domains list. When that
        lands, this input is what gets replaced.
      -->
      <label class="mt-6 flex flex-col gap-2">
        <span class="text-sm font-medium">
          {{ t('workshop.run.apiKey', locale) }}
        </span>
        <input
          v-model="draft"
          type="password"
          autocomplete="off"
          spellcheck="false"
          :placeholder="t('workshop.run.apiKeyPlaceholder', locale)"
          class="focus:border-primary-comfy-yellow h-11 rounded-xl border border-primary-comfy-canvas/15 bg-primary-comfy-canvas/5 px-4 font-mono text-sm outline-none"
        />
      </label>

      <button
        type="submit"
        :disabled="draft === ''"
        class="hover:bg-primary-comfy-yellow/90 mt-5 h-12 w-full rounded-xl bg-primary-comfy-yellow font-semibold text-primary-comfy-ink transition-colors disabled:cursor-not-allowed disabled:opacity-40"
      >
        {{ t('workshop.auth.continue', locale) }}
      </button>

      <p class="mt-4 text-center text-xs text-primary-comfy-canvas/45">
        <a
          href="https://platform.comfy.org/profile/api-keys"
          target="_blank"
          rel="noopener noreferrer"
          class="hover:text-primary-comfy-yellow underline"
        >
          {{ t('workshop.model.getApiKey', locale) }}
        </a>
      </p>
    </form>
  </dialog>
</template>
