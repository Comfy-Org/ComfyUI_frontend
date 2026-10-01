<script setup lang="ts">
import BrandButton from '../../common/BrandButton.vue'
import SectionLabel from '../../common/SectionLabel.vue'

defineProps<{
  headingId?: string
  label?: string
  description?: string
  actionLabel?: string
  actionHref?: string
}>()
</script>

<template>
  <div class="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
    <div class="flex flex-col gap-2">
      <h2 :id="headingId">
        <SectionLabel>{{ label }}</SectionLabel>
      </h2>
      <p class="text-base font-light text-primary-warm-gray">
        {{ description }}
      </p>
    </div>
    <div v-if="actionHref && actionLabel" class="shrink-0">
      <BrandButton :href="actionHref" variant="outline" size="xs">
        {{ actionLabel }}
      </BrandButton>
    </div>
  </div>
</template>
