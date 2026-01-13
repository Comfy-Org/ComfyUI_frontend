<template>
  <div class="flex items-center gap-2 p-4 font-bold">
    <img
      v-if="!flags.huggingfaceModelImportEnabled"
      src="/assets/images/civitai.svg"
      class="size-4"
    />
    <span>{{ $t(titleKey) }}</span>
    <span
      class="rounded-full bg-white px-1.5 py-0 text-xxs font-inter font-semibold uppercase text-black"
    >
      {{ $t('g.beta') }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { useFeatureFlags } from '@/composables/useFeatureFlags'

const { flags } = useFeatureFlags()

const titleKey = computed(() => {
  return flags.huggingfaceModelImportEnabled
    ? 'assetBrowser.uploadModelGeneric'
    : 'assetBrowser.uploadModelFromCivitai'
})
</script>
