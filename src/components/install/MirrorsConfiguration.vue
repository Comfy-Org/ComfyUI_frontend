<template>
  <Panel
    :header="$t('install.settings.mirrorSettings')"
    toggleable
    :collapsed="!showMirrorInputs"
    pt:root="bg-neutral-800 border-none w-[600px]"
  >
    <template
      v-for="([item, modelValue], index) in mirrors"
      :key="item.settingId + item.mirror"
    >
      <Divider v-if="index > 0" />

      <MirrorItem
        v-model="modelValue.value"
        :item="item"
        @state-change="validationStates[index] = $event"
      />
    </template>
    <template #icons>
      <i
        v-tooltip="validationStateTooltip"
        :class="{
          'pi pi-spin pi-spinner text-neutral-400':
            validationState === ValidationState.LOADING,
          'pi pi-check text-green-500':
            validationState === ValidationState.VALID,
          'pi pi-times text-red-500':
            validationState === ValidationState.INVALID
        }"
      />
    </template>
  </Panel>
</template>

<script setup lang="ts">
import {
  TorchDeviceType,
  TorchMirrorUrl
} from '@comfyorg/comfyui-electron-types'
import Divider from 'primevue/divider'
import Panel from 'primevue/panel'
import { ModelRef, computed, onMounted, ref } from 'vue'

import MirrorItem from '@/components/install/mirror/MirrorItem.vue'
import { PYPI_MIRROR, PYTHON_MIRROR, UVMirror } from '@/constants/uvMirrors'
import { t } from '@/i18n'
import { isInChina } from '@/utils/networkUtil'
import { ValidationState, mergeValidationStates } from '@/utils/validationUtil'

const showMirrorInputs = ref(false)
const { device } = defineProps<{ device: TorchDeviceType | null }>()
const pythonMirror = defineModel<string>('pythonMirror', { required: true })
const pypiMirror = defineModel<string>('pypiMirror', { required: true })
const torchMirror = defineModel<string>('torchMirror', { required: true })

const getTorchMirrorItem = (device: TorchDeviceType): UVMirror => {
  const settingId = 'Comfy-Desktop.UV.TorchInstallMirror'
  switch (device) {
    case 'mps':
      return {
        settingId,
        mirror: TorchMirrorUrl.NightlyCpu,
        fallbackMirror: TorchMirrorUrl.NightlyCpu
      }
    case 'nvidia':
      return {
        settingId,
        mirror: TorchMirrorUrl.Cuda,
        fallbackMirror: TorchMirrorUrl.Cuda
      }
    case 'cpu':
    default:
      return {
        settingId,
        mirror: PYPI_MIRROR.mirror,
        fallbackMirror: PYPI_MIRROR.fallbackMirror
      }
  }
}

const userIsInChina = ref(false)
onMounted(async () => {
  userIsInChina.value = await isInChina()
})

const useFallbackMirror = (mirror: UVMirror) => ({
  ...mirror,
  mirror: mirror.fallbackMirror
})

const mirrors = computed<[UVMirror, ModelRef<string>][]>(() =>
  (
    [
      [PYTHON_MIRROR, pythonMirror],
      [PYPI_MIRROR, pypiMirror],
      [getTorchMirrorItem(device ?? 'cpu'), torchMirror]
    ] as [UVMirror, ModelRef<string>][]
  ).map(([item, modelValue]) => [
    userIsInChina.value ? useFallbackMirror(item) : item,
    modelValue
  ])
)

const validationStates = ref<ValidationState[]>(
  mirrors.value.map(() => ValidationState.IDLE)
)
const validationState = computed(() => {
  return mergeValidationStates(validationStates.value)
})
const validationStateTooltip = computed(() => {
  switch (validationState.value) {
    case ValidationState.INVALID:
      return t('install.settings.mirrorsUnreachable')
    case ValidationState.VALID:
      return t('install.settings.mirrorsReachable')
    default:
      return t('install.settings.checkingMirrors')
  }
})
</script>
