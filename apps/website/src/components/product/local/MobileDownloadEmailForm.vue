<script setup lang="ts">
import { ArrowRight } from '@lucide/vue'
import { computed, nextTick, onMounted, ref, useId } from 'vue'

import type { Locale } from '../../../i18n/translations'

import IconButton from '@/components/ui/icon-button/IconButton.vue'
import { useDownloadUrl } from '../../../composables/useDownloadUrl'
import { t } from '../../../i18n/translations'
import {
  isDownloadLinkRequestEnabled,
  preloadDownloadLinkAnalytics,
  requestDownloadLink
} from '../../../scripts/customerio'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const { isMobileUa } = useDownloadUrl()

type FormStatus = 'idle' | 'invalid' | 'pending' | 'error' | 'success'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const email = ref('')
const decoy = ref('')
const submittedEmail = ref('')
const status = ref<FormStatus>('idle')

const isVisible = computed(
  () => isDownloadLinkRequestEnabled && isMobileUa.value
)

const errorMessageId = useId()
const successRegion = ref<HTMLParagraphElement | null>(null)

const successMessage = computed(() =>
  status.value === 'success'
    ? t('download.emailForm.success', locale).replace(
        '{email}',
        () => submittedEmail.value
      )
    : ''
)

const errorMessage = computed(() => {
  if (status.value === 'invalid')
    return t('download.emailForm.invalidEmail', locale)
  if (status.value === 'error') return t('download.emailForm.error', locale)
  return ''
})

// Removing the form drops keyboard/SR focus, so move it to the success message.
async function showSuccess() {
  status.value = 'success'
  await nextTick()
  successRegion.value?.focus()
}

// The component mounts on every client; only visible (mobile) forms may load the SDK.
onMounted(() => {
  if (isVisible.value) preloadDownloadLinkAnalytics()
})

async function onSubmit() {
  if (status.value === 'pending') return
  if (decoy.value !== '') {
    submittedEmail.value = email.value
    await showSuccess()
    return
  }
  if (!EMAIL_PATTERN.test(email.value)) {
    status.value = 'invalid'
    return
  }
  submittedEmail.value = email.value
  status.value = 'pending'
  try {
    await requestDownloadLink(submittedEmail.value, locale)
    await showSuccess()
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
      class="flex flex-col gap-4"
      @submit.prevent="onSubmit"
    >
      <h2 class="text-primary-comfy-yellow text-[17px] font-medium">
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
          :aria-label="t('download.emailForm.emailLabel', locale)"
          :aria-invalid="status === 'invalid' || undefined"
          :aria-describedby="errorMessage ? errorMessageId : undefined"
          :placeholder="t('download.emailForm.placeholder', locale)"
          class="bg-transparency-white-t4 h-16 w-full rounded-3xl border border-primary-comfy-canvas pr-14 pl-4 text-[13px] font-semibold text-primary-comfy-canvas placeholder:text-primary-comfy-canvas/60"
        />
        <IconButton
          type="submit"
          variant="solid"
          size="sm"
          class="absolute right-4 rounded-xl"
          :disabled="status === 'pending'"
          :aria-busy="status === 'pending'"
          :aria-label="t('download.emailForm.submit', locale)"
        >
          <span
            v-if="status === 'pending'"
            aria-hidden="true"
            class="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
          <ArrowRight v-else class="size-5" aria-hidden="true" />
        </IconButton>
      </div>
      <p
        v-if="errorMessage"
        :id="errorMessageId"
        role="alert"
        class="text-primary-comfy-orange -mt-2 text-sm"
      >
        {{ errorMessage }}
      </p>
    </form>
    <!-- Persistent live region: role="status" only announces reliably when the
         element exists in the accessibility tree before its content changes. -->
    <p
      ref="successRegion"
      role="status"
      tabindex="-1"
      :class="
        status === 'success'
          ? 'bg-transparency-white-t4 text-primary-warm-gray flex h-16 items-center rounded-3xl px-4 text-[13px] font-semibold wrap-break-word focus:outline-none'
          : undefined
      "
    >
      {{ successMessage }}
    </p>
  </div>
</template>
