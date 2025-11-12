<template>
  <div class="flex flex-col gap-6">
    <div class="flex flex-col gap-2">
      <p class="text-sm text-muted mb-0">
        {{ $t('assetBrowser.uploadModelDescription1') }}
      </p>
      <ul class="list-disc space-y-1 pl-5 mt-0 text-sm text-muted">
        <li>{{ $t('assetBrowser.uploadModelDescription2') }}</li>
        <li>{{ $t('assetBrowser.uploadModelDescription3') }}</li>
      </ul>
    </div>

    <div class="flex flex-col gap-2">
      <label for="civitai-link" class="text-sm text-muted mb-0">
        {{ $t('assetBrowser.civitaiLinkLabel') }}
      </label>
      <input
        id="civitai-link"
        :value="modelValue"
        type="text"
        :placeholder="$t('assetBrowser.civitaiLinkPlaceholder')"
        class="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-muted outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      />
      <p class="text-xs text-muted">
        {{ $t('assetBrowser.civitaiLinkExample') }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  modelValue: string
}>()

defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>
