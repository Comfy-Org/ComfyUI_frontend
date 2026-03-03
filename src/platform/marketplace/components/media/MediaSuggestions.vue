<template>
  <div v-if="assets.length" class="flex flex-col gap-2">
    <label class="text-xs font-medium text-muted">{{ label }}</label>
    <div class="flex gap-2 overflow-x-auto pb-1">
      <button
        v-for="asset in assets"
        :key="asset.preview_url"
        :class="
          cn(
            'relative size-24 shrink-0 overflow-hidden rounded-lg border transition-colors',
            isSelected(asset)
              ? 'border-primary-background'
              : 'border-border-default hover:border-primary-background/50'
          )
        "
        @click="emit('select', asset.preview_url!)"
      >
        <img
          :src="asset.preview_url"
          :alt="asset.name"
          class="size-full object-cover"
        />
        <div
          v-if="isSelected(asset)"
          class="absolute inset-0 flex items-center justify-center bg-black/30"
        >
          <i class="icon-[lucide--check] size-5 text-white" />
        </div>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { cn } from '@/utils/tailwindUtil'

const { assets, selectedUrls } = defineProps<{
  label: string
  assets: AssetItem[]
  selectedUrls: string[]
}>()

const emit = defineEmits<{
  select: [url: string]
}>()

function isSelected(asset: AssetItem): boolean {
  return selectedUrls.includes(asset.preview_url!)
}
</script>
