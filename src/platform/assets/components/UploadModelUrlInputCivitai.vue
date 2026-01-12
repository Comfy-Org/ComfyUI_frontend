<template>
  <div class="flex flex-col gap-6 text-sm text-muted-foreground">
    <div class="flex flex-col gap-2">
      <p class="m-0">
        {{ $t('assetBrowser.uploadModelDescription1') }}
      </p>
      <ul class="list-disc space-y-1 pl-5 mt-0">
        <li>
          <i18n-t keypath="assetBrowser.uploadModelDescription2" tag="span">
            <template #link>
              <a
                href="https://civitai.com/models"
                target="_blank"
                class="text-muted-foreground underline"
              >
                {{ $t('assetBrowser.uploadModelDescription2Link') }}
              </a>
            </template>
          </i18n-t>
        </li>
        <li v-if="!flags.asyncModelUploadEnabled">
          <i18n-t keypath="assetBrowser.uploadModelDescription3" tag="span">
            <template #size>
              <span class="font-bold italic">{{
                $t('assetBrowser.maxFileSizeValue')
              }}</span>
            </template>
          </i18n-t>
        </li>
      </ul>
    </div>

    <div class="flex flex-col gap-2">
      <i18n-t keypath="assetBrowser.civitaiLinkLabel" tag="label" class="mb-0">
        <template #download>
          <span class="font-bold italic">{{
            $t('assetBrowser.civitaiLinkLabelDownload')
          }}</span>
        </template>
      </i18n-t>
      <div class="relative">
        <InputText
          v-model="url"
          autofocus
          :placeholder="$t('assetBrowser.civitaiLinkPlaceholder')"
          class="w-full border-0 bg-secondary-background p-4 pr-10"
          data-attr="upload-model-step1-url-input"
        />
        <i
          v-if="isValidUrl"
          class="icon-[lucide--circle-check-big] absolute top-1/2 right-3 size-5 -translate-y-1/2 text-green-500"
        />
      </div>
      <p v-if="error" class="text-xs text-error">
        {{ error }}
      </p>
      <i18n-t
        v-else
        keypath="assetBrowser.civitaiLinkExample"
        tag="p"
        class="text-xs"
      >
        <template #example>
          <strong>{{ $t('assetBrowser.civitaiLinkExampleStrong') }}</strong>
        </template>
        <template #link>
          <a
            href="https://civitai.com/models/10706/luisap-z-image-and-qwen-pixel-art-refiner?modelVersionId=2225295"
            target="_blank"
            class="text-muted-foreground underline"
          >
            {{ $t('assetBrowser.civitaiLinkExampleUrl') }}
          </a>
        </template>
      </i18n-t>
    </div>
  </div>
</template>

<script setup lang="ts">
import InputText from 'primevue/inputtext'
import { computed } from 'vue'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { civitaiImportSource } from '@/platform/assets/importSources/civitaiImportSource'
import { validateSourceUrl } from '@/platform/assets/utils/importSourceUtil'

const { flags } = useFeatureFlags()

defineProps<{
  error?: string
}>()

const url = defineModel<string>({ required: true })

const isValidUrl = computed(() => {
  const trimmedUrl = url.value.trim()
  if (!trimmedUrl) return false
  return validateSourceUrl(trimmedUrl, civitaiImportSource)
})
</script>
