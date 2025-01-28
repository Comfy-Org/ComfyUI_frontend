<template>
  <Panel
    :header="$t('install.settings.mirrorSettings')"
    toggleable
    :collapsed="!showMirrorInputs"
    pt:root="bg-neutral-800 border-none w-[600px]"
  >
    <template v-for="(item, index) in mirrorItems" :key="item.settingId">
      <Divider v-if="index > 0" />

      <div class="flex flex-col items-center gap-4">
        <div class="w-full">
          <h3 class="text-lg font-medium text-neutral-100">
            {{ $t(`settings.${item.settingId}.name`) }}
          </h3>
          <p class="text-sm text-neutral-400 mt-1">
            {{ $t(`settings.${item.settingId}.tooltip`) }}
          </p>
        </div>
        <UrlInput
          v-model="item.modelValue.value"
          :validate-url-fn="item.checkMirrorReachable"
        />
      </div>
    </template>
  </Panel>
</template>

<script setup lang="ts">
import {
  CUDA_TORCH_URL,
  NIGHTLY_CPU_TORCH_URL
} from '@comfyorg/comfyui-electron-types'
import Divider from 'primevue/divider'
import Panel from 'primevue/panel'
import { ModelRef, onMounted, ref } from 'vue'

import UrlInput from '@/components/common/UrlInput.vue'
import {
  DEFAULT_UV_PYPI_INSTALL_MIRROR,
  DEFAULT_UV_PYTHON_INSTALL_MIRROR,
  FALLBACK_UV_PYPI_INSTALL_MIRROR,
  FALLBACK_UV_PYTHON_INSTALL_MIRROR
} from '@/constants/uvMirrors'
import { electronAPI } from '@/utils/envUtil'
import { isValidUrl } from '@/utils/formatUtil'

const checkingMirrors = ref(false)
const showMirrorInputs = ref(false)
const pythonMirror = defineModel<string>('pythonMirror', { required: true })
const pypiMirror = defineModel<string>('pypiMirror', { required: true })
const torchMirror = defineModel<string>('torchMirror', { required: true })

const checkMirrorReachable = async (mirror: string) => {
  return (
    isValidUrl(mirror) && (await electronAPI().NetWork.canAccessUrl(mirror))
  )
}

interface MirrorItem {
  settingId: string
  mirror: string
  fallbackMirror: string
  checkMirrorReachable: (mirror: string) => Promise<boolean>
  modelValue: ModelRef<string>
}

const DEFAULT_TORCH_MIRROR =
  electronAPI().getPlatform() === 'darwin'
    ? NIGHTLY_CPU_TORCH_URL
    : CUDA_TORCH_URL

const mirrorItems: MirrorItem[] = [
  {
    settingId: 'Comfy-Desktop_UV_PythonInstallMirror',
    mirror: DEFAULT_UV_PYTHON_INSTALL_MIRROR,
    fallbackMirror: FALLBACK_UV_PYTHON_INSTALL_MIRROR,
    checkMirrorReachable: (mirror: string) =>
      checkMirrorReachable(
        mirror +
          '/cpython-3.12.4%2B20240713-aarch64-apple-darwin-install_only.tar.gz'
      ),
    modelValue: pythonMirror
  },
  {
    settingId: 'Comfy-Desktop_UV_PypiInstallMirror',
    mirror: DEFAULT_UV_PYPI_INSTALL_MIRROR,
    fallbackMirror: FALLBACK_UV_PYPI_INSTALL_MIRROR,
    checkMirrorReachable,
    modelValue: pypiMirror
  },
  {
    settingId: 'Comfy-Desktop_UV_TorchInstallMirror',
    mirror: DEFAULT_TORCH_MIRROR,
    fallbackMirror: DEFAULT_TORCH_MIRROR,
    checkMirrorReachable,
    modelValue: torchMirror
  }
]

onMounted(async () => {
  checkingMirrors.value = true
  const mirrorsReachable = await Promise.all(
    mirrorItems.map((item) => item.checkMirrorReachable(item.mirror))
  )
  checkingMirrors.value = false

  showMirrorInputs.value = mirrorsReachable.some((reachable) => !reachable)

  if (showMirrorInputs.value) {
    mirrorItems.forEach((item) => {
      if (!mirrorsReachable[item.settingId]) {
        item.modelValue.value = item.fallbackMirror
      }
    })
  }
})
</script>
