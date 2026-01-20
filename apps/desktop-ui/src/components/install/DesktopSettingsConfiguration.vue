<template>
  <div class="flex w-[600px] flex-col gap-6">
    <div class="flex flex-col gap-4">
      <h2 class="text-2xl font-semibold text-neutral-100">
        {{ $t('install.desktopAppSettings') }}
      </h2>

      <p class="my-0 text-neutral-400">
        {{ $t('install.desktopAppSettingsDescription') }}
      </p>
    </div>

    <div class="flex flex-col rounded-lg bg-neutral-800 p-4 text-sm">
      <!-- Auto Update Setting -->
      <div class="flex items-center gap-4">
        <div class="flex-1">
          <h3 class="text-lg font-medium text-neutral-100">
            {{ $t('install.settings.autoUpdate') }}
          </h3>
          <p class="mt-1 text-neutral-400">
            {{ $t('install.settings.autoUpdateDescription') }}
          </p>
        </div>
        <ToggleSwitch v-model="autoUpdate" />
      </div>

      <Divider />

      <!-- Metrics Collection Setting -->
      <div class="flex items-center gap-4">
        <div class="flex-1">
          <h3 class="text-lg font-medium text-neutral-100">
            {{ $t('install.settings.allowMetrics') }}
          </h3>
          <p class="text-neutral-400">
            {{ $t('install.settings.allowMetricsDescription') }}
          </p>
          <a
            href="#"
            @click.prevent="showMetricsInfo"
          >
            {{ $t('install.settings.learnMoreAboutData') }}
          </a>
        </div>
        <ToggleSwitch v-model="allowMetrics" />
      </div>
    </div>

    <!-- Info Dialog -->
    <Dialog
      v-model:visible="showDialog"
      modal
      dismissable-mask
      :header="$t('install.settings.dataCollectionDialog.title')"
      class="select-none"
    >
      <div class="text-neutral-300">
        <h4 class="mb-2 font-medium">
          {{ $t('install.settings.dataCollectionDialog.whatWeCollect') }}
        </h4>
        <ul class="list-disc space-y-1 pl-6">
          <li>
            {{
              $t('install.settings.dataCollectionDialog.collect.errorReports')
            }}
          </li>
          <li>
            {{ $t('install.settings.dataCollectionDialog.collect.systemInfo') }}
          </li>
          <li>
            {{
              $t(
                'install.settings.dataCollectionDialog.collect.userJourneyEvents'
              )
            }}
          </li>
        </ul>

        <h4 class="mt-4 mb-2 font-medium">
          {{ $t('install.settings.dataCollectionDialog.whatWeDoNotCollect') }}
        </h4>
        <ul class="list-disc space-y-1 pl-6">
          <li>
            {{
              $t(
                'install.settings.dataCollectionDialog.doNotCollect.personalInformation'
              )
            }}
          </li>
          <li>
            {{
              $t(
                'install.settings.dataCollectionDialog.doNotCollect.workflowContents'
              )
            }}
          </li>
          <li>
            {{
              $t(
                'install.settings.dataCollectionDialog.doNotCollect.fileSystemInformation'
              )
            }}
          </li>
          <li>
            {{
              $t(
                'install.settings.dataCollectionDialog.doNotCollect.customNodeConfigurations'
              )
            }}
          </li>
        </ul>

        <div class="mt-4">
          <a
            href="https://comfy.org/privacy"
            target="_blank"
          >
            {{ $t('install.settings.dataCollectionDialog.viewFullPolicy') }}
          </a>
        </div>
      </div>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import Dialog from 'primevue/dialog'
import Divider from 'primevue/divider'
import ToggleSwitch from 'primevue/toggleswitch'
import { ref } from 'vue'

const showDialog = ref(false)
const autoUpdate = defineModel<boolean>('autoUpdate', { required: true })
const allowMetrics = defineModel<boolean>('allowMetrics', { required: true })

const showMetricsInfo = () => {
  showDialog.value = true
}
</script>
