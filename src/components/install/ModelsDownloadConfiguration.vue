<template>
  <Panel
    :header="$t('install.settings.modelsDownloadSettings')"
    toggleable
    :collapsed="!showModelsDownloadInputs"
    pt:root="bg-neutral-800 border-none w-[600px]"
  >
    <template>

      <MirrorItem
        :item="extraAllowedSource"
        v-model="extraAllowedSource.value"
        @state-change="validationState = $event"
      />
    </template>
    <template #icons>
      <i
        :class="{
          'pi pi-spin pi-spinner text-neutral-400':
            validationState === ValidationState.LOADING,
          'pi pi-check text-green-500':
            validationState === ValidationState.VALID,
          'pi pi-times text-red-500':
            validationState === ValidationState.INVALID
        }"
        v-tooltip="validationStateTooltip"
      />
    </template>
  </Panel>
</template>

<script setup lang="ts">
import Panel from 'primevue/panel'
import { ModelRef, computed, ref } from 'vue'

import MirrorItem from '@/components/install/mirror/MirrorItem.vue'
import { MODELS_DOWNLOAD_SETTINGS, ModelsDownloadSettings } from '@/constants/modelsDownloadSettings'
import { t } from '@/i18n'
import { ValidationState } from '@/utils/validationUtil'

const showModelsDownloadInputs = ref(false)
const extraAllowedSource = defineModel<string>('extraAllowedSource', { required: true })

const extraAllowedUrl = computed<[ModelsDownloadSettings, ModelRef<string>][]>(() =>
  (
    [
      [MODELS_DOWNLOAD_SETTINGS, extraAllowedSource]
    ] as [ModelsDownloadSettings, ModelRef<string>][]
  ).map(([item, modelValue]) => [
    item,
    modelValue
  ])
)

const validationState = ref<ValidationState>(ValidationState.IDLE)

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
