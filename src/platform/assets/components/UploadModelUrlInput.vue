<template>
  <div class="flex h-full flex-col justify-between gap-6 text-sm">
    <div class="flex flex-col gap-6">
      <div class="flex flex-col gap-2">
        <p class="text-foreground m-0">
          {{ $t('assetBrowser.uploadModelDescription1Generic') }}
        </p>
        <div class="m-0">
          <p class="m-0 text-muted-foreground">
            {{ $t('assetBrowser.uploadModelDescription2Generic') }}
          </p>
          <span class="mt-2 inline-flex flex-wrap items-center gap-1">
            <span class="inline-flex items-center gap-1">
              <img
                :src="civitaiIcon"
                :alt="$t('assetBrowser.providerCivitai')"
                class="h-4 w-4"
              >
              <a
                :href="civitaiUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="text-muted-foreground underline"
              >
                {{ $t('assetBrowser.providerCivitai') }}</a><span>,</span>
            </span>
            <span class="inline-flex items-center gap-1">
              <img
                :src="huggingFaceIcon"
                :alt="$t('assetBrowser.providerHuggingFace')"
                class="h-4 w-4"
              >
              <a
                :href="huggingFaceUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="text-muted-foreground underline"
              >
                {{ $t('assetBrowser.providerHuggingFace') }}
              </a>
            </span>
          </span>
        </div>
      </div>

      <div class="flex flex-col gap-2">
        <div class="relative">
          <InputText
            v-model="url"
            autofocus
            :placeholder="$t('assetBrowser.genericLinkPlaceholder')"
            class="w-full border-0 bg-secondary-background p-4 pr-10"
            data-attr="upload-model-step1-url-input"
          />
          <i
            v-if="isValidUrl"
            class="absolute top-1/2 right-3 icon-[lucide--circle-check-big] size-5 -translate-y-1/2 text-green-500"
          />
        </div>
        <p
          v-if="error"
          class="text-sm text-error"
        >
          {{ error }}
        </p>
        <p
          v-else-if="!flags.asyncModelUploadEnabled"
          class="text-foreground"
        >
          <i18n-t
            keypath="assetBrowser.maxFileSize"
            tag="span"
          >
            <template #size>
              <span class="font-bold italic">{{
                $t('assetBrowser.maxFileSizeValue')
              }}</span>
            </template>
          </i18n-t>
        </p>
      </div>
    </div>

    <div class="text-sm text-muted">
      {{ $t('assetBrowser.uploadModelHelpFooterText') }}
    </div>
  </div>
</template>

<script setup lang="ts">
import InputText from 'primevue/inputtext'
import { computed } from 'vue'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { civitaiImportSource } from '@/platform/assets/importSources/civitaiImportSource'
import { huggingfaceImportSource } from '@/platform/assets/importSources/huggingfaceImportSource'
import { validateSourceUrl } from '@/platform/assets/utils/importSourceUtil'

const { flags } = useFeatureFlags()

const props = defineProps<{
  modelValue: string
  error?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const url = computed({
  get: () => props.modelValue,
  set: (value: string) => emit('update:modelValue', value)
})

const importSources = [civitaiImportSource, huggingfaceImportSource]

const isValidUrl = computed(() => {
  const trimmedUrl = url.value.trim()
  if (!trimmedUrl) return false
  return importSources.some((source) => validateSourceUrl(trimmedUrl, source))
})

const civitaiIcon = '/assets/images/civitai.svg'
const civitaiUrl = 'https://civitai.com/models'
const huggingFaceIcon = '/assets/images/hf-logo.svg'
const huggingFaceUrl = 'https://huggingface.co'
</script>
