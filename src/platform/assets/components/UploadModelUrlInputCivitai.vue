<template>
  <div class="flex flex-col gap-6 text-sm text-muted-foreground">
    <div class="flex flex-col gap-2">
      <p class="m-0">
        {{ $t('assetBrowser.uploadModelDescription1') }}
      </p>
      <ul class="list-disc space-y-1 pl-5 mt-0">
        <li v-html="$t('assetBrowser.uploadModelDescription2')" />
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
      <label class="mb-0" v-html="$t('assetBrowser.civitaiLinkLabel')"></label>
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
      <p v-else v-html="$t('assetBrowser.civitaiLinkExample')"></p>
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
