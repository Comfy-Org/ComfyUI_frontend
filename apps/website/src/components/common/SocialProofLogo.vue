<script setup lang="ts">
const { name } = defineProps<{ name: string }>()

const partnerLogoSources: Record<string, string> = {
  'Native Foreign': '/images/agency-partners/native-foreign-white.png',
  'Black Math': '/images/agency-partners/black-math-stacked.png'
}
</script>

<template>
  <span
    v-if="partnerLogoSources[name]"
    role="img"
    :aria-label="name"
    class="h-10 w-32 bg-secondary-mauve mask-contain mask-center mask-no-repeat md:h-20 md:w-40"
    :style="{
      maskImage: `url('${partnerLogoSources[name]}')`,
      scale: name === 'Native Foreign' ? '0.7' : undefined
    }"
  />
  <img v-else :src="`/icons/clients/${name}.svg`" :alt="name" />
</template>
