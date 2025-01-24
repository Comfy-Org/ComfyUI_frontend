<template>
  <div class="flex flex-col gap-6 w-[600px]">
    <div class="flex flex-col gap-4">
      <h2 class="text-2xl font-semibold text-neutral-100">
        {{ $t('install.desktopAppSettings') }}
      </h2>

      <p class="text-neutral-400 my-0">
        {{ $t('install.desktopAppSettingsDescription') }}
      </p>
    </div>

    <div class="flex flex-col bg-neutral-800 p-4 rounded-lg">
      <!-- Auto Update Setting -->
      <div class="flex items-center gap-4">
        <div class="flex-1">
          <h3 class="text-lg font-medium text-neutral-100">
            {{ $t('install.settings.autoUpdate') }}
          </h3>
          <p class="text-sm text-neutral-400 mt-1">
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
          <p class="text-sm text-neutral-400 mt-1">
            {{ $t('install.settings.allowMetricsDescription') }}
          </p>
          <a
            href="#"
            class="text-sm text-blue-400 hover:text-blue-300 mt-1 inline-block"
            @click.prevent="showMetricsInfo"
          >
            {{ $t('install.settings.learnMoreAboutData') }}
          </a>
        </div>
        <ToggleSwitch v-model="allowMetrics" />
      </div>

      <!-- Mirror Settings (Conditional) -->
      <template v-if="showMirrorInputs">
        <Divider />

        <!-- Python Mirror Setting -->
        <div class="flex flex-col items-center gap-4">
          <div class="w-full">
            <h3 class="text-lg font-medium text-neutral-100">
              {{ $t('settings.Comfy-Desktop_PythonInstallMirror.name') }}
            </h3>
            <p class="text-sm text-neutral-400 mt-1">
              {{ $t('settings.Comfy-Desktop_PythonInstallMirror.tooltip') }}
            </p>
          </div>
          <UrlInput
            v-model="pythonMirror"
            :placeholder="$t('install.settings.pythonMirrorPlaceholder')"
            :validate-url-fn="checkPythonMirrorReachable"
          />
        </div>

        <Divider />

        <!-- Pypi Mirror Setting -->
        <div class="flex flex-col items-center gap-4">
          <div class="w-full">
            <h3 class="text-lg font-medium text-neutral-100">
              {{ $t('settings.Comfy-Desktop_PypiMirror.name') }}
            </h3>
            <p class="text-sm text-neutral-400 mt-1">
              {{ $t('settings.Comfy-Desktop_PypiMirror.tooltip') }}
            </p>
          </div>
          <UrlInput
            v-model="pypiMirror"
            :placeholder="$t('install.settings.pypiMirrorPlaceholder')"
            :validate-url-fn="checkPypiMirrorReachable"
          />
        </div>
      </template>
    </div>

    <!-- Info Dialog -->
    <Dialog
      v-model:visible="showDialog"
      modal
      :header="$t('install.settings.dataCollectionDialog.title')"
    >
      <div class="text-neutral-300">
        <h4 class="font-medium mb-2">
          {{ $t('install.settings.dataCollectionDialog.whatWeCollect') }}
        </h4>
        <ul class="list-disc pl-6 space-y-1">
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

        <h4 class="font-medium mt-4 mb-2">
          {{ $t('install.settings.dataCollectionDialog.whatWeDoNotCollect') }}
        </h4>
        <ul class="list-disc pl-6 space-y-1">
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
            class="text-blue-400 hover:text-blue-300 underline"
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
import { onMounted, ref } from 'vue'

import UrlInput from '@/components/common/UrlInput.vue'
import {
  DEFAULT_UV_PYPY_INSTALL_MIRROR,
  DEFAULT_UV_PYTHON_INSTALL_MIRROR,
  FALLBACK_UV_PYPY_INSTALL_MIRROR,
  FALLBACK_UV_PYTHON_INSTALL_MIRROR
} from '@/constants/uvMirrors'
import { electronAPI } from '@/utils/envUtil'
import { isValidUrl } from '@/utils/formatUtil'

const showDialog = ref(false)
const showMirrorInputs = ref(false)
const autoUpdate = defineModel<boolean>('autoUpdate', { required: true })
const allowMetrics = defineModel<boolean>('allowMetrics', { required: true })
const pythonMirror = defineModel<string>('pythonMirror', { required: true })
const pypiMirror = defineModel<string>('pypiMirror', { required: true })

const checkPythonMirrorReachable = async (mirror: string) => {
  return (
    isValidUrl(mirror) &&
    (await electronAPI().NetWork.canAccessUrl(
      `${mirror}/cpython-3.10.16+20250115-aarch64-apple-darwin-debug-full.tar.zst`
    ))
  )
}

const checkPypiMirrorReachable = async (mirror: string) => {
  return (
    isValidUrl(mirror) &&
    (await electronAPI().NetWork.canAccessUrl(
      `${mirror}/pypy3.8-v7.3.7-osx64.tar.bz2`
    ))
  )
}

onMounted(async () => {
  const isPythonMirrorReachable = await checkPythonMirrorReachable(
    DEFAULT_UV_PYTHON_INSTALL_MIRROR
  )
  const isPypiMirrorReachable = await checkPypiMirrorReachable(
    DEFAULT_UV_PYPY_INSTALL_MIRROR
  )
  showMirrorInputs.value = !isPythonMirrorReachable || !isPypiMirrorReachable

  if (showMirrorInputs.value) {
    pythonMirror.value = FALLBACK_UV_PYTHON_INSTALL_MIRROR
    pypiMirror.value = FALLBACK_UV_PYPY_INSTALL_MIRROR
  }
})

const showMetricsInfo = () => {
  showDialog.value = true
}
</script>
