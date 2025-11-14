<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-col gap-2">
      <p class="text-sm text-muted m-0">
        {{ $t('assetBrowser.uploadModelDescription1') }}
      </p>
      <ul class="list-disc space-y-1 pl-5 mt-0 text-sm text-muted">
        <li>{{ $t('assetBrowser.uploadModelDescription2') }}</li>
        <li>{{ $t('assetBrowser.uploadModelDescription3') }}</li>
      </ul>
    </div>

    <div class="flex flex-col gap-2">
      <label class="text-sm text-muted mb-0">
        {{ $t('assetBrowser.civitaiLinkLabel') }}
      </label>
      <UrlInput
        v-model="url"
        :placeholder="$t('assetBrowser.civitaiLinkPlaceholder')"
        :disable-validation="true"
      />
      <p class="text-xs text-muted">
        {{ $t('assetBrowser.civitaiLinkExample') }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import UrlInput from '@/components/common/UrlInput.vue'

const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const url = computed({
  get: () => props.modelValue,
  set: (value: string) => emit('update:modelValue', value)
})
</script>
