<template>
  <div class="flex flex-col gap-3">
    <div class="flex items-start gap-2">
      <i class="pi pi-check mt-1 text-sm" />
      <span class="text-sm">
        {{ $t('subscription.benefits.benefit1') }}
      </span>
    </div>

    <div class="flex items-start gap-2">
      <i class="pi pi-check mt-1 text-sm" />
      <span class="text-sm">
        {{ $t('subscription.benefits.benefit2') }}
      </span>
    </div>

    <Button
      :label="$t('subscription.viewMoreDetails')"
      text
      icon="pi pi-external-link"
      icon-pos="left"
      size="small"
      class="self-start !p-0 text-sm hover:!bg-transparent [&]:!text-[inherit]"
      @click="handleViewMoreDetails"
    />
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'

const handleViewMoreDetails = () => {
  window.open('https://www.comfy.org/cloud', '_blank')
}
</script>
