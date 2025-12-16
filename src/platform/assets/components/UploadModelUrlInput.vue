<template>
  <div
    class="flex flex-col justify-between h-full gap-6 text-sm text-muted-foreground"
  >
    <div class="flex flex-col gap-6">
      <div class="flex flex-col gap-2">
        <p class="m-0 text-white">
          {{ $t('assetBrowser.uploadModelDescription1Generic') }}
        </p>
        <div class="m-0">
          <p class="m-0">
            {{ $t('assetBrowser.uploadModelDescription2Generic') }}
          </p>
          <span class="inline-flex items-center gap-1 flex-wrap mt-2">
            <!-- eslint-disable @intlify/vue-i18n/no-raw-text -->
            <span class="inline-flex items-center gap-1">
              <img
                src="/assets/images/civitai.svg"
                alt="Civitai"
                class="w-4 h-4"
              />
              <a
                href="https://civitai.com"
                target="_blank"
                rel="noopener noreferrer"
                class="text-muted underline"
              >
                Civitai</a
              ><span>,</span>
            </span>
            <span class="inline-flex items-center gap-1">
              <img
                src="/assets/images/hf-logo.svg"
                alt="Hugging Face"
                class="w-4 h-4"
              />
              <a
                href="https://huggingface.co"
                target="_blank"
                rel="noopener noreferrer"
                class="text-muted underline"
              >
                Hugging Face
              </a>
            </span>
            <!-- eslint-enable @intlify/vue-i18n/no-raw-text -->
          </span>
        </div>
      </div>

      <div class="flex flex-col gap-2">
        <InputText
          v-model="url"
          autofocus
          :placeholder="$t('assetBrowser.genericLinkPlaceholder')"
          class="w-full bg-secondary-background border-0 p-4"
          data-attr="upload-model-step1-url-input"
        />
        <p v-if="error" class="text-xs text-error">
          {{ error }}
        </p>
        <p
          v-else
          class="text-white"
          v-html="$t('assetBrowser.maxFileSize')"
        ></p>
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
</script>
