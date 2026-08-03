<script setup lang="ts">
import { ArrowRight } from '@lucide/vue'
import { cn } from '@comfyorg/tailwind-utils'
import { computed, onMounted, ref } from 'vue'

import type { Locale, TranslationKey } from '../../../i18n/translations'

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
const status = ref<FormStatus>('idle')

const isVisible = computed(
  () => isDownloadLinkRequestEnabled && isMobileUa.value
)

const STATUS_MESSAGE_KEYS: Partial<Record<FormStatus, TranslationKey>> = {
  success: 'download.emailForm.success',
  invalid: 'download.emailForm.invalidEmail',
  error: 'download.emailForm.error'
}

const statusMessage = computed(() => {
  const key = STATUS_MESSAGE_KEYS[status.value]
  return key ? t(key, locale).replace('{email}', email.value) : ''
})

// The component mounts on every client; only visible (mobile) forms may load the SDK.
onMounted(() => {
  if (isVisible.value) preloadDownloadLinkAnalytics()
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
    await requestDownloadLink(email.value, locale)
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
          :aria-label="t('download.emailForm.heading', locale)"
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
    </form>
    <p
      role="status"
      :class="
        cn(
          status === 'success' &&
            'bg-transparency-white-t4 text-primary-warm-gray flex h-16 items-center rounded-3xl px-4 text-[13px] font-semibold',
          (status === 'invalid' || status === 'error') &&
            'text-primary-comfy-orange mt-2 text-sm'
        )
      "
    >
      {{ statusMessage }}
    </p>
  </div>
</template>
