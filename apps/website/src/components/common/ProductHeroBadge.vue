<script setup lang="ts">
const {
  logoSrc = '/icons/logo.svg',
  logoAlt = 'Comfy',
  text = 'LOCAL'
} = defineProps<{
  logoSrc?: string
  logoAlt?: string
  text?: string
}>()
</script>

<template>
  <div class="font-formula-condensed flex items-stretch font-semibold">
    <img
      src="/icons/node-left.svg"
      alt=""
      class="-mx-px my-auto h-12 self-center lg:my-0 lg:h-auto lg:self-stretch"
      aria-hidden="true"
    />

    <span
      class="bg-primary-comfy-yellow text-primary-comfy-ink my-auto flex h-12 items-center justify-center lg:my-0 lg:h-auto lg:p-8"
    >
      <img
        :src="logoSrc"
        :alt="logoAlt"
        class="inline-block h-6 brightness-0 lg:h-10"
      />
    </span>

    <img
      src="/icons/node-union-2size.svg"
      alt=""
      class="-mx-px my-auto h-12 self-center lg:my-0 lg:h-auto lg:self-stretch"
      aria-hidden="true"
    />

    <span
      class="bg-primary-comfy-yellow text-primary-comfy-ink my-auto flex h-7.25 items-center justify-center lg:h-15.5 lg:px-6"
    >
      <span
        class="inline-block translate-y-0.5 text-2xl leading-none font-bold lg:text-3xl"
      >
        {{ text }}
      </span>
    </span>

    <img
      src="/icons/node-right.svg"
      alt=""
      class="-mx-px my-auto h-7.25 self-center lg:h-15.5"
      aria-hidden="true"
    />
  </div>
</template>
