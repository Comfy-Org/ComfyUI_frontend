<template>
  <div
    class="flex flex-col select-none font-sans items-center h-screen m-0 text-neutral-300 bg-neutral-900 dark-theme pointer-events-auto"
  >
    <!-- Installation Path Section -->
    <div
      class="comfy-installer grow flex flex-col gap-4 text-neutral-300 max-w-110"
    >
      <h2 class="text-2xl font-semibold text-neutral-100">
        {{ $t('install.manualConfiguration.title') }}
      </h2>

      <p class="m-1 text-neutral-300">
        <Tag
          icon="pi pi-exclamation-triangle"
          severity="warn"
          :value="t('icon.exclamation-triangle')"
        ></Tag>
        <strong class="ml-2">{{
          $t('install.gpuSelection.customComfyNeedsPython')
        }}</strong>
      </p>

      <div>
        <p class="m-1 mb-4">
          {{ $t('install.manualConfiguration.requirements') }}:
        </p>
        <ul class="m-0">
          <li>{{ $t('install.gpuSelection.customManualVenv') }}</li>
          <li>{{ $t('install.gpuSelection.customInstallRequirements') }}</li>
        </ul>
      </div>

      <p class="m-1">{{ $t('install.manualConfiguration.createVenv') }}:</p>

      <Panel :header="t('install.manualConfiguration.virtualEnvironmentPath')">
        <span class="font-mono">{{ `${basePath}${sep}.venv${sep}` }}</span>
      </Panel>

      <p class="m-1">
        {{ $t('install.manualConfiguration.restartWhenFinished') }}
      </p>

      <Button
        class="place-self-end"
        :label="t('menuLabels.Restart')"
        severity="warn"
        icon="pi pi-refresh"
        @click="restartApp('Manual configuration complete')"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import Panel from 'primevue/panel'
import Tag from 'primevue/tag'
import { electronAPI } from '@/utils/envUtil'
import { useI18n } from 'vue-i18n'
import { onMounted, ref } from 'vue'

const { t } = useI18n()

const electron = electronAPI()

const basePath = ref<string>(null)
const sep = ref<'\\' | '/'>('/')

const restartApp = (message?: string) => electron.restartApp(message)

onMounted(async () => {
  basePath.value = await electron.getBasePath()
  if (basePath.value.indexOf('/') === -1) sep.value = '\\'
})
</script>

<style>
:root {
  --p-tag-gap: 0.5rem;
}

.comfy-installer {
  margin-top: max(1rem, max(0px, calc((100vh - 42rem) * 0.5)));
}
</style>
