<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { computed, onMounted, ref } from 'vue'

import type { Locale, TranslationKey } from '../../../i18n/translations'

import { useDownloadLinkRequest } from '../../../composables/useDownloadLinkRequest'
import { useDownloadUrl } from '../../../composables/useDownloadUrl'
import { t } from '../../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const { isEnabled, preload, submit } = useDownloadLinkRequest(locale)
const { isMobileUa } = useDownloadUrl()

type FormStatus = 'idle' | 'invalid' | 'pending' | 'error' | 'success'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const email = ref('')
const decoy = ref('')
const status = ref<FormStatus>('idle')

const isVisible = computed(() => isEnabled && isMobileUa.value)

const STATUS_MESSAGE_KEYS: Partial<Record<FormStatus, TranslationKey>> = {
  success: 'download.emailForm.success',
  invalid: 'download.emailForm.invalidEmail',
  error: 'download.emailForm.error'
}

const statusMessage = computed(() => {
  const key = STATUS_MESSAGE_KEYS[status.value]
  return key ? t(key, locale) : ''
})

// The component mounts on every client; only visible (mobile) forms may load the SDK.
onMounted(() => {
  if (isVisible.value) preload()
})

async function onSubmit() {
  if (status.value === 'pending') return
  if (decoy.value !== '') {
    status.value = 'success'
    return
  }
  if (!EMAIL_PATTERN.test(email.value)) {
    status.value = 'invalid'
    return
  }
  status.value = 'pending'
  try {
    await submit(email.value)
    status.value = 'success'
  } catch {
    status.value = 'error'
  }
}
</script>

<template>
  <div v-if="isVisible">
    <form
      v-if="status !== 'success'"
      novalidate
      class="flex flex-col gap-3"
      @submit.prevent="onSubmit"
    >
      <h2 class="text-primary-comfy-yellow text-lg font-bold">
        {{ t('download.emailForm.heading', locale) }}
      </h2>
      <input
        v-model="decoy"
        type="text"
        name="company"
        tabindex="-1"
        aria-hidden="true"
        autocomplete="off"
        class="absolute left-[-9999px] size-px"
      />
      <div class="relative flex items-center">
        <input
          v-model="email"
          type="email"
          required
          autocomplete="email"
          :aria-label="t('download.emailForm.heading', locale)"
          :placeholder="t('download.emailForm.placeholder', locale)"
          class="bg-primary-comfy-ink-light w-full rounded-full py-3 pr-14 pl-5 text-sm text-primary-comfy-canvas placeholder:text-primary-comfy-canvas/50"
        />
        <button
          type="submit"
          :disabled="status === 'pending'"
          :aria-busy="status === 'pending'"
          :aria-label="t('download.emailForm.submit', locale)"
          class="bg-primary-comfy-yellow absolute right-2 inline-flex size-9 cursor-pointer items-center justify-center rounded-xl text-primary-comfy-ink transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <span
            v-if="status === 'pending'"
            aria-hidden="true"
            class="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
          <span v-else aria-hidden="true">→</span>
        </button>
      </div>
    </form>
    <p
      role="status"
      :class="
        cn(
          'text-sm',
          status === 'success'
            ? 'text-primary-comfy-canvas'
            : 'text-primary-comfy-orange'
        )
      "
    >
      {{ statusMessage }}
    </p>
  </div>
</template>
