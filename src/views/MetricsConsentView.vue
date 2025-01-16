<template>
  <BaseViewTemplate dark>
    <div class="h-full p-8 2xl:p-16 flex flex-col items-center justify-center">
      <div
        class="bg-neutral-800 rounded-lg shadow-lg p-6 w-full max-w-[600px] flex flex-col gap-6"
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
            class="text-blue-400 hover:text-blue-300 underline"
          >
            {{ $t('install.privacyPolicy') }} </a
          >.
        </p>
        <div class="flex items-center gap-4">
          <ToggleSwitch
            v-model="allowMetrics"
            :ariaLabel="
              allowMetrics
                ? $t('install.metricsEnabled')
                : $t('install.metricsDisabled')
            "
          />
          <span class="text-neutral-100">
            {{
              allowMetrics
                ? $t('install.metricsEnabled')
                : $t('install.metricsDisabled')
            }}
          </span>
        </div>
        <div class="flex pt-6 justify-end">
          <Button
            :label="$t('g.ok')"
            icon="pi pi-check"
            iconPos="right"
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
import { ref } from 'vue'
import { useRouter } from 'vue-router'

import { electronAPI } from '@/utils/envUtil'

const allowMetrics = ref(true)
const router = useRouter()

const updateConsent = () => {
  electronAPI().setMetricsConsent(allowMetrics.value)
  router.push('/')
}
</script>
