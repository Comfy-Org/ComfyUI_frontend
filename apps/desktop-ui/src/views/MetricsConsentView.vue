<template>
  <BaseViewTemplate
    dark
    hide-language-selector
  >
    <div class="flex h-full flex-col items-center justify-center p-8 2xl:p-16">
      <div
        class="flex w-full max-w-[600px] flex-col gap-6 rounded-lg bg-neutral-800 p-6 shadow-lg"
      >
        <h2 class="text-3xl font-semibold text-neutral-100">
          {{ $t('install.helpImprove') }}
        </h2>
        <p class="text-neutral-400">
          {{ $t('install.updateConsent') }}
        </p>
        <p class="text-neutral-400">
          {{ $t('install.moreInfo') }}
          <a
            href="https://comfy.org/privacy"
            target="_blank"
            class="text-blue-400 underline hover:text-blue-300"
          >
            {{ $t('install.privacyPolicy') }} </a>.
        </p>
        <div class="flex items-center gap-4">
          <ToggleSwitch
            v-model="allowMetrics"
            aria-describedby="metricsDescription"
          />
          <span
            id="metricsDescription"
            class="text-neutral-100"
          >
            {{
              allowMetrics
                ? $t('install.metricsEnabled')
                : $t('install.metricsDisabled')
            }}
          </span>
        </div>
        <div class="flex justify-end pt-6">
          <Button
            :label="$t('g.ok')"
            icon="pi pi-check"
            :loading="isUpdating"
            icon-pos="right"
            @click="updateConsent"
          />
        </div>
      </div>
    </div>
  </BaseViewTemplate>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import ToggleSwitch from 'primevue/toggleswitch'
import { useToast } from 'primevue/usetoast'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { electronAPI } from '@/utils/envUtil'

const toast = useToast()
const { t } = useI18n()

const allowMetrics = ref(true)
const router = useRouter()
const isUpdating = ref(false)

const updateConsent = async () => {
  isUpdating.value = true
  try {
    await electronAPI().setMetricsConsent(allowMetrics.value)
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: t('install.settings.errorUpdatingConsent'),
      detail: t('install.settings.errorUpdatingConsentDetail'),
      life: 3000
    })
  } finally {
    isUpdating.value = false
  }
  await router.push('/')
}
</script>
