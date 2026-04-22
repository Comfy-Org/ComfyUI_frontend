<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import BrandButton from '../../common/BrandButton.vue'
import GlassCard from '../../common/GlassCard.vue'
import SectionHeader from '../../common/SectionHeader.vue'

interface Feature {
  title: string
  description: string
  description2?: string
  ctaText?: string
  ctaHref?: string
  image: string
}

defineProps<{
  heading: string
  subtitle: string
  features: Feature[]
}>()
</script>

<template>
  <section class="px-4 py-24 lg:px-20">
    <SectionHeader>
      {{ heading }}
      <template #subtitle>
        <p class="mt-4 text-sm text-smoke-700 lg:text-base">
          {{ subtitle }}
        </p>
      </template>
    </SectionHeader>

    <!-- Features -->
    <div class="mt-24 flex flex-col gap-4 lg:gap-8">
      <GlassCard
        v-for="(feature, i) in features"
        :key="i"
        class="flex flex-col gap-8 lg:flex-row lg:items-stretch lg:gap-12"
      >
        <!-- Text -->
        <div
          :class="
            cn(
              'order-2 flex flex-col p-6 lg:w-1/2 lg:justify-between',
              i % 2 === 0 ? 'lg:order-1' : 'lg:order-2'
            )
          "
        >
          <h3 class="text-primary-comfy-canvas text-2xl font-light lg:text-3xl">
            {{ feature.title }}
          </h3>
          <div class="mt-6 lg:mt-0">
            <p class="text-sm text-smoke-700 lg:text-base">
              {{ feature.description }}
            </p>
            <p
              v-if="feature.description2"
              class="mt-4 text-sm text-smoke-700 lg:text-base"
            >
              {{ feature.description2 }}
            </p>
            <BrandButton
              v-if="feature.ctaText && feature.ctaHref"
              :href="feature.ctaHref"
              variant="solid"
              size="xs"
              class="mt-6"
            >
              {{ feature.ctaText }}
            </BrandButton>
          </div>
        </div>

        <!-- Image -->
        <div
          :class="
            cn('order-1 lg:w-1/2', i % 2 === 0 ? 'lg:order-2' : 'lg:order-1')
          "
        >
          <img
            :src="feature.image"
            :alt="feature.title"
            class="aspect-4/3 w-full rounded-4xl object-cover"
          />
        </div>
      </GlassCard>
    </div>
  </section>
</template>
