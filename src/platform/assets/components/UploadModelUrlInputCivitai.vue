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
                class="text-muted-foreground"
              >
                {{ $t('assetBrowser.uploadModelDescription2Link') }}
              </a>
            </template>
          </i18n-t>
        </li>
        <li>
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
      <InputText
        v-model="url"
        autofocus
        :placeholder="$t('assetBrowser.civitaiLinkPlaceholder')"
        class="w-full bg-secondary-background border-0 p-4"
        data-attr="upload-model-step1-url-input"
      />
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
            class="text-muted-foreground"
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

defineProps<{
  error?: string
}>()

const url = defineModel<string>({ required: true })
</script>
