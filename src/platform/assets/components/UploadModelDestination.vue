<template>
  <div class="flex flex-col gap-2 text-sm">
    <span :id="labelId" class="text-muted-foreground">
      {{ $t('assetBrowser.fileUpload.destination') }}
    </span>
    <RadioGroup
      :model-value="destination"
      :aria-labelledby="labelId"
      :disabled="disabled"
      class="flex-wrap gap-4"
      data-attr="upload-model-destination"
      @update:model-value="choose"
    >
      <label
        v-for="option in options"
        :key="option.value"
        class="flex cursor-pointer items-center gap-2 text-foreground"
      >
        <RadioGroupItem :value="option.value" />
        {{ option.label }}
      </label>
    </RadioGroup>
    <Button
      v-if="buildOffered"
      variant="link"
      size="link"
      class="self-start"
      data-attr="upload-model-add-to-build"
      @click="emit('build')"
    >
      {{ $t('assetBrowser.fileUpload.addToBuild') }}
    </Button>
  </div>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import RadioGroup from '@comfyorg/design-system/radio-group/RadioGroup'
import RadioGroupItem from '@comfyorg/design-system/radio-group/RadioGroupItem'
import type { UploadDestination } from '@/platform/assets/composables/useUploadModelFile'

const { disabled = false, buildOffered = false } = defineProps<{
  disabled?: boolean
  buildOffered?: boolean
}>()

const emit = defineEmits<{
  build: []
}>()

const destination = defineModel<UploadDestination>({ required: true })

const { t } = useI18n()
const labelId = useId()

const options = computed<{ value: UploadDestination; label: string }[]>(() => [
  { value: 'library', label: t('assetBrowser.fileUpload.toLibrary') },
  { value: 'deployment', label: t('assetBrowser.fileUpload.toDeployment') }
])

function choose(value: unknown) {
  const option = options.value.find((candidate) => candidate.value === value)
  if (option) destination.value = option.value
}
</script>
