<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import type { Locale } from '../../../i18n/translations'

import { useDownloadLinkRequest } from '../../../composables/useDownloadLinkRequest'
import { useDownloadUrl } from '../../../composables/useDownloadUrl'
import { t } from '../../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const { isEnabled, preload, submit } = useDownloadLinkRequest(locale)
const { isMobileUa } = useDownloadUrl()

const email = ref('')
const isPending = ref(false)
const isSuccess = ref(false)

const isVisible = computed(() => isEnabled && isMobileUa.value)

// The component mounts on every client; only visible (mobile) forms may load the SDK.
onMounted(() => {
  if (isVisible.value) preload()
})

async function onSubmit() {
  isPending.value = true
  try {
    await submit(email.value)
    isSuccess.value = true
  } finally {
    isPending.value = false
  }
}
</script>

<template>
  <div v-if="isVisible">
    <p v-if="isSuccess" class="text-sm text-primary-comfy-canvas">
      {{ t('download.emailForm.success', locale) }}
    </p>
    <form v-else class="flex flex-col gap-3" @submit.prevent="onSubmit">
      <h2 class="text-primary-comfy-yellow text-lg font-bold">
        {{ t('download.emailForm.heading', locale) }}
      </h2>
      <div class="relative flex items-center">
        <input
          v-model="email"
          type="email"
          required
          autocomplete="email"
          :aria-label="t('download.emailForm.heading', locale)"
          :placeholder="t('download.emailForm.placeholder', locale)"
          class="border-primary-comfy-yellow w-full rounded-2xl border bg-transparent py-3 pr-14 pl-4 text-sm text-primary-comfy-canvas placeholder:text-primary-comfy-canvas/50"
        />
        <button
          type="submit"
          :disabled="isPending"
          :aria-label="t('download.emailForm.submit', locale)"
          class="bg-primary-comfy-yellow absolute right-2 inline-flex size-9 cursor-pointer items-center justify-center rounded-xl text-primary-comfy-ink transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </form>
  </div>
</template>
