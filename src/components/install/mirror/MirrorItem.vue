<template>
  <div class="flex flex-col items-center gap-4">
    <div class="w-full">
      <h3 class="text-lg font-medium text-neutral-100">
        {{ $t(`settings.${normalizedSettingId}.name`) }}
      </h3>
      <p class="text-sm text-neutral-400 mt-1">
        {{ $t(`settings.${normalizedSettingId}.tooltip`) }}
      </p>
    </div>
    <UrlInput
      v-model="modelValue"
      :validate-url-fn="checkMirrorReachable"
      @state-change="validationState = $event"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import { UVMirror } from '@/constants/uvMirrors'
import { electronAPI } from '@/utils/envUtil'
import { isValidUrl, normalizeI18nKey } from '@/utils/formatUtil'
import { ValidationState } from '@/utils/validationUtil'

const { item } = defineProps<{
  item: UVMirror
}>()

const emit = defineEmits<{
  'state-change': [state: ValidationState]
}>()

const modelValue = defineModel<string>('modelValue', { required: true })
const validationState = ref<ValidationState>(ValidationState.IDLE)

const normalizedSettingId = computed(() => {
  return normalizeI18nKey(item.settingId)
})

const checkMirrorReachable = async (mirror: string) => {
  return (
    isValidUrl(mirror) &&
    (await electronAPI().NetWork.canAccessUrl(
      mirror + (item.validationPathSuffix ?? '')
    ))
  )
}

onMounted(() => {
  modelValue.value = item.mirror
})

watch(validationState, (newState) => {
  emit('state-change', newState)

  // Set fallback mirror if default mirror is invalid
  if (
    newState === ValidationState.INVALID &&
    modelValue.value === item.mirror
  ) {
    modelValue.value = item.fallbackMirror
  }
})
</script>
