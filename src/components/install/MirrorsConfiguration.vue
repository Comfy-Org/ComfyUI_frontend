<template>
  <Panel
    :header="$t('install.settings.mirrorSettings')"
    toggleable
    :collapsed="!showMirrorInputs"
    pt:root="bg-neutral-800 border-none w-[600px]"
  >
    <template
      v-for="([item, modelValue], index) in mirrors"
      :key="item.settingId"
    >
      <Divider v-if="index > 0" />

      <MirrorItem
        :item="item"
        v-model="modelValue.value"
        @state-change="validationStates[index] = $event"
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
import _ from 'lodash'
import Divider from 'primevue/divider'
import Panel from 'primevue/panel'
import { computed, ref } from 'vue'

import MirrorItem from '@/components/install/mirror/MirrorItem.vue'
import { UV_MIRRORS } from '@/constants/uvMirrors'
import { t } from '@/i18n'
import { ValidationState, mergeValidationStates } from '@/utils/validationUtil'

const showMirrorInputs = ref(false)
const pythonMirror = defineModel<string>('pythonMirror', { required: true })
const pypiMirror = defineModel<string>('pypiMirror', { required: true })
const torchMirror = defineModel<string>('torchMirror', { required: true })

const mirrors = _.zip(UV_MIRRORS, [pythonMirror, pypiMirror, torchMirror])

const validationStates = ref<ValidationState[]>(
  mirrors.map(() => ValidationState.IDLE)
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
