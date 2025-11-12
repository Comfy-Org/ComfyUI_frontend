<template>
  <div class="flex flex-col gap-6">
    <!-- Model Info Section -->
    <div class="flex flex-col gap-2">
      <p class="text-sm text-muted mb-0">
        {{ $t('assetBrowser.modelAssociatedWithLink') }}
      </p>
      <p class="text-sm mt-0">
        {{ metadata?.name || metadata?.filename }}
      </p>
    </div>

    <!-- Model Type Selection -->
    <div class="flex flex-col gap-2">
      <label for="model-type" class="text-sm text-muted">
        {{ $t('assetBrowser.whatTypeOfModel') }}
      </label>
      <select
        id="model-type"
        :value="modelValue"
        class="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
      >
        <option
          v-for="option in modelTypeOptions"
          :key="option.value"
          :value="option.value"
        >
          {{ option.label }}
        </option>
      </select>
      <div class="flex items-center gap-2 text-sm text-muted">
        <i class="icon-[lucide--info]" />
        <span>{{ $t('assetBrowser.notSureLeaveAsIs') }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface ModelMetadata {
  content_length: number
  final_url: string
  content_type?: string
  filename?: string
  name?: string
  tags?: string[]
  preview_url?: string
}

defineProps<{
  modelValue: string
  metadata: ModelMetadata | null
}>()

defineEmits<{
  'update:modelValue': [value: string]
}>()

const modelTypeOptions = [
  { label: 'LoRA', value: 'lora' },
  { label: 'Checkpoint', value: 'checkpoint' },
  { label: 'Embedding', value: 'embedding' },
  { label: 'VAE', value: 'vae' },
  { label: 'Upscale Model', value: 'upscale_model' },
  { label: 'ControlNet', value: 'controlnet' }
]
</script>
