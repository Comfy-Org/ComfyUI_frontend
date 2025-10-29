<template>
  <div class="flex flex-col items-start gap-1 self-stretch">
    <div class="flex items-start gap-2">
      <i class="pi pi-check mt-1 text-xs text-text-primary" />
      <span class="text-sm text-text-primary">
        {{ $t('subscription.benefits.benefit1') }}
      </span>
    </div>

    <div class="flex items-start gap-2">
      <i class="pi pi-check mt-1 text-xs text-text-primary" />
      <span class="text-sm text-text-primary">
        {{ $t('subscription.benefits.benefit2') }}
      </span>
    </div>

    <Button
      :label="$t('subscription.viewMoreDetails')"
      text
      icon="pi pi-external-link"
      icon-pos="left"
      class="flex h-8 min-h-6 py-2 px-0 items-center gap-2 rounded text-text-secondary"
      :pt="{
        icon: {
          class: 'text-xs text-text-secondary'
        },
        label: {
          class: 'text-sm text-text-secondary'
        }
      }"
      @click="handleViewMoreDetails"
    />
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'

const handleViewMoreDetails = () => {
  window.open('https://www.comfy.org/cloud/pricing', '_blank')
}
</script>
