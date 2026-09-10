<script setup lang="ts">
import SectionHeader from '../../components/common/SectionHeader.vue'
import BrandButton from '../../components/common/BrandButton.vue'

const { header, body, supporting, ctaLabel, ctaHref } = defineProps<{
  header: string
  body: string
  supporting?: string
  ctaLabel?: string
  ctaHref?: string
}>()
</script>

<template>
  <section class="mx-auto max-w-3xl px-6 py-10 text-center lg:py-14">
    <SectionHeader max-width="xl" heading-size="compact">
      {{ header }}
    </SectionHeader>
    <p class="mx-auto mt-6 max-w-2xl text-sm/relaxed text-primary-comfy-canvas">
      {{ body }}
    </p>
    <p
      v-if="supporting"
      class="mx-auto mt-4 max-w-2xl text-sm/relaxed text-primary-comfy-canvas/70"
    >
      {{ supporting }}
    </p>
    <div v-if="ctaLabel && ctaHref" class="mt-8 flex justify-center">
      <BrandButton
        :href="ctaHref"
        size="lg"
        class="px-8 py-4 text-base uppercase"
      >
        {{ ctaLabel }}
      </BrandButton>
    </div>
  </section>
</template>
