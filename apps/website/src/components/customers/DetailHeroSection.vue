<script setup lang="ts">
import BrandButton from '../common/BrandButton.vue'

interface ButtonProps {
  label: string
  href: string
}

const { label, title, description, primaryButton, secondaryButton, image } =
  defineProps<{
    label?: string
    title: string
    description?: string
    primaryButton?: ButtonProps
    secondaryButton?: ButtonProps
    image?: string
  }>()
</script>

<template>
  <section class="pt-16 lg:px-20 lg:pt-40 lg:pb-8">
    <div class="mx-auto flex max-w-4xl flex-col items-center text-center">
      <span
        v-if="label"
        class="text-primary-comfy-yellow text-xs font-semibold tracking-widest uppercase"
      >
        {{ label }}
      </span>

      <h1
        class="text-primary-comfy-canvas mt-4 text-3xl/tight font-light lg:text-5xl/tight"
      >
        {{ title }}
      </h1>

      <p
        v-if="description"
        class="text-primary-warm-gray mt-6 max-w-xl text-sm/relaxed lg:text-base/relaxed"
      >
        {{ description }}
      </p>

      <div
        v-if="primaryButton || secondaryButton"
        class="mt-8 flex flex-wrap justify-center gap-3"
      >
        <BrandButton
          v-if="primaryButton"
          :href="primaryButton.href"
          :label="primaryButton.label"
          variant="outline"
        />
        <BrandButton
          v-if="secondaryButton"
          :href="secondaryButton.href"
          :label="secondaryButton.label"
          variant="solid"
        />
      </div>
    </div>

    <div v-if="image" class="mt-12 overflow-hidden px-6 lg:mt-16 lg:px-20">
      <img :src="image" :alt="title" class="w-full rounded-3xl object-cover" />
    </div>
  </section>
</template>
