<template>
  <BaseViewTemplate dark>
    <div class="h-full p-8 2xl:p-16 flex flex-col items-center justify-center">
      <div
        class="bg-neutral-800 rounded-lg shadow-lg p-6 w-full max-w-[600px] flex flex-col gap-6"
      >
        <h2 class="text-2xl font-semibold text-neutral-100">
          {{ $t('metricsConsentTitle', 'Please help us improve') }}
        </h2>
        <p class="text-neutral-400">
          {{
            $t(
              'metricsConsentDescription',
              `You previously opted in to reporting crashes. We are now tracking event-based metrics
              to help identify bugs and improve the app. No personal identifiable information is collected.`
            )
          }}
        </p>
        <p class="text-neutral-400">
          {{ $t('metricsPrivacyNotice', 'For more info, please read our') }}
          <a
            href="https://comfy.org/privacy"
            target="_blank"
            class="text-blue-400 hover:text-blue-300 underline"
          >
            {{ $t('metricsPrivacyPolicy', 'privacy policy') }} </a
          >.
        </p>
        <div class="flex items-center gap-4">
          <ToggleSwitch v-model="allowMetrics" />
          <span class="text-neutral-100">
            {{
              allowMetrics
                ? $t('metricsEnabled', 'Metrics Enabled')
                : $t('metricsDisabled', 'Metrics Disabled')
            }}
          </span>
        </div>
        <div class="flex pt-6 justify-end">
          <Button
            :label="$t('g.ok', 'OK')"
            icon="pi pi-check"
            iconPos="right"
            @click="acknowledgeConsent"
          />
        </div>
      </div>
    </div>
  </BaseViewTemplate>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import ToggleSwitch from 'primevue/toggleswitch'
import { ref } from 'vue'
import { useRouter } from 'vue-router'

import { useSettingStore } from '@/stores/settingStore'
import { electronAPI } from '@/utils/envUtil'

const allowMetrics = ref(false)
const router = useRouter()
const settingStore = useSettingStore()

const acknowledgeConsent = () => {
  settingStore.set('Comfy-Desktop.SendStatistics', allowMetrics.value)
  settingStore.set('Comfy-Desktop.HasSeenMetricsUpdate', true)
  electronAPI().Config.reportMetricsConsent(allowMetrics.value)
  router.push('/')
}
</script>
