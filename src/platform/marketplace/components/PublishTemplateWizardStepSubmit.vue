<template>
  <div data-testid="step-submit" class="flex flex-col gap-4">
    <div
      v-if="submitted"
      class="border-success bg-success/10 rounded-lg border p-4 text-sm"
    >
      {{ $t('marketplace.submitted') }}
    </div>
    <div v-else class="flex flex-col gap-2 text-sm">
      <p>{{ $t('marketplace.previewDescription') }}</p>
      <div class="flex justify-center">
        <div class="w-full max-w-72">
          <MarketplaceTemplatePreviewCard
            :title="form.title"
            :short-description="form.shortDescription"
            :description="form.description"
            :license-label="licenseLabel"
            :tags="form.tags"
            :thumbnail-url="thumbnailUrl"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import MarketplaceTemplatePreviewCard from '@/platform/marketplace/components/MarketplaceTemplatePreviewCard.vue'

defineProps<{
  form: {
    title: string
    description: string
    shortDescription: string
    tags: string[]
  }
  submitted: boolean
  licenseLabel: string
  thumbnailUrl: string | null
}>()
</script>
